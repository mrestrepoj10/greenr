import { elevationZeroZ } from '../../casa/elevation'
import { areaWeighted, glazingTypes, uValue, type GlazingType } from '../../casa/glazing'
import { cardinalRows } from '../../casa/orientation4'
import { mergePending, pendingFor, roomPlacement, scopeOf, select, unplacedBlocker } from '../../casa/scope'
import { GUIDE } from '../../guide'
import { positive } from '../../params'
import type { Element, InputValue, Measure, ValueSource } from '../../types'
import { deriveUnits } from '../../units'
import { buildingOf } from '../building'
import { tallyFacade } from '../eem01'
import { labelFamily } from '../labels'
import { measureResult } from '../result'

export const C_ENV_LABELS = {
  gross: 'Gross façade area, N+E+S+W',
  wwr: 'Overall window-to-wall ratio',
  footprint: 'Building footprint, plan area covered by indoor rooms',
  floorsAbove: 'Floors above grade',
  floorsBelow: 'Floors below grade',
  roof: 'Roof area',
  levels: 'Levels in the model',
  height: 'Building height, level elevation 0 to the highest roof top',
  f2fMin: 'Floor-to-floor height, minimum',
  f2fAverage: 'Floor-to-floor height, average',
  windowHeight: 'Average window height',
  shading: 'Shading elements',
  glazingU: 'Glazing U, area-weighted over types with a value',
  glazingShgc: 'Glazing SHGC, area-weighted over types with a value',
  wallU: 'Exterior wall U, area-weighted over types with a value',
  roofU: 'Roof U, area-weighted over types with a value',
} as const

/** One row per glazing, exterior wall and roof type, after the building-wide values. */
export const C_ENV_TYPES = {
  glazing: labelFamily('Glazing type: '),
  wall: labelFamily('Exterior wall type: '),
  roof: labelFamily('Roof type: '),
} as const

type Typed = { typeKey: string; dbIds: number[]; areaM2: number; u: number | null }

function byType(elements: Element[]): Typed[] {
  const groups = new Map<string, Element[]>()
  for (const e of elements) groups.set(e.typeKey, [...(groups.get(e.typeKey) ?? []), e])
  return [...groups]
    .map(([typeKey, list]) => ({ typeKey, dbIds: list.map((e) => e.dbId), areaM2: list.reduce((s, e) => s + (e.area ?? 0), 0), u: uValue(list[0].params) }))
    .sort((a, b) => b.areaM2 - a.areaM2 || a.typeKey.localeCompare(b.typeKey))
}

const fixed = (x: number | null, digits = 2) => (x === null ? 'missing' : x.toFixed(digits))
const glazingText = (t: GlazingType) => `U ${fixed(t.u)}, SHGC ${fixed(t.shgc)}, VT ${fixed(t.vt)}`

/** Floor-to-floor from consecutive levels that carry dwelling units, for models whose rooms cannot be probed. */
function unitLevelSteps(levels: { name: string; elevation: number }[], unitLevels: Set<string>): number[] {
  const z = levels
    .filter((l) => unitLevels.has(l.name))
    .map((l) => l.elevation)
    .sort((a, b) => a - b)
  return z.slice(1).map((v, i) => v - z[i])
}

/**
 * The envelope sheet for MS&C §2, GGc5, SBp3 and Ep1 option 2. Façade areas and WWR need the room probe, so with
 * most rooms unplaced they are withheld and the measure blocks; roof, levels, heights and glazing types still report.
 */
export const C_ENV: Measure = {
  scheme: 'CASA',
  code: 'C-ENV',
  guide: GUIDE['C-ENV'],
  credits: ['GGc5', 'SBp3', 'Ep1', 'MS&C §2'],
  compute(snapshot, classifications, exclusions) {
    const L = C_ENV_LABELS
    const scope = scopeOf(snapshot, classifications, exclusions)
    const b = buildingOf(snapshot, classifications, exclusions)
    const placement = roomPlacement(snapshot)
    const inputs: InputValue[] = []
    const pending: Parameters<typeof mergePending>[0] = []
    const tally = placement.unplaced ? null : tallyFacade(snapshot, classifications, exclusions)
    const rows = tally ? cardinalRows(snapshot, tally.walls, tally.openings) : undefined
    if (tally && rows) {
      const gross = rows.reduce((s, r) => s + r.wallAreaM2, 0)
      const glazed = rows.reduce((s, r) => s + r.glazingAreaM2, 0)
      inputs.push(
        { label: L.gross, value: gross, unit: 'm²', source: 'mixed', dbIds: rows.flatMap((r) => r.wallDbIds) },
        { label: L.wwr, value: gross > 0 ? glazed / gross : null, unit: 'ratio', source: 'mixed' },
        { label: L.footprint, value: b.storeys.footprintM2, unit: 'm²', source: 'geometry' },
        { label: L.floorsAbove, value: b.storeys.above, unit: 'floors', source: 'rooms' },
        { label: L.floorsBelow, value: b.storeys.below, unit: 'floors', source: 'rooms' },
      )
      pending.push({ pendingTypeKeys: tally.pendingTypeKeys, pendingExclusionIds: tally.pendingExclusionIds })
    }

    const roofs = byType(b.roofs)
    const zeroZ = elevationZeroZ(snapshot)
    const roofTop = b.roofs.length ? Math.max(...b.roofs.map((r) => r.bbox?.[5] ?? -Infinity)) : null
    const useRooms = !placement.unplaced && b.ff.roomsMeasured > 0
    const steps = useRooms ? [...b.ff.byRoom.values()] : unitLevelSteps(snapshot.levels, new Set(deriveUnits(snapshot).map((u) => u.level)))
    const stepSource: ValueSource = useRooms ? 'rooms' : 'levels'
    inputs.push(
      { label: L.roof, value: roofs.reduce((s, t) => s + t.areaM2, 0), unit: 'm²', source: 'parameter', dbIds: b.roofs.map((r) => r.dbId) },
      { label: L.levels, value: snapshot.levels.length, unit: 'levels', source: 'levels' },
      { label: L.height, value: roofTop === null || !Number.isFinite(roofTop) ? null : roofTop - zeroZ, unit: 'm', source: 'geometry' },
      { label: L.f2fMin, value: steps.length ? Math.min(...steps) : null, unit: 'm', source: stepSource },
      {
        label: L.f2fAverage,
        value: useRooms ? b.ff.averageM : steps.length ? steps.reduce((s, x) => s + x, 0) / steps.length : null,
        unit: 'm',
        source: stepSource,
      },
    )
    pending.push({ pendingTypeKeys: b.pendingTypeKeys, pendingExclusionIds: b.pendingExclusionIds })

    const windows = select(scope, ['window'], /Windows/)
    const heights = windows.used.map((w) => w.height || positive(w.params, 'Height')).filter((h): h is number => !!h)
    const shading = select(scope, ['shading'], /Generic Models/)
    const glazing = glazingTypes(scope)
    const exterior = select(scope, ['exterior-wall'], /Walls/)
    const walls = byType(exterior.used)
    inputs.push(
      { label: L.windowHeight, value: heights.length ? heights.reduce((s, h) => s + h, 0) / heights.length : null, unit: 'm', source: 'parameter' },
      { label: L.shading, value: shading.used.length, unit: 'elements', source: 'parameter', dbIds: shading.used.map((e) => e.dbId) },
      { label: L.glazingU, value: areaWeighted(glazing.types, (t) => t.u), unit: 'W/m²K', source: 'parameter' },
      { label: L.glazingShgc, value: areaWeighted(glazing.types, (t) => t.shgc), unit: 'ratio', source: 'parameter' },
      { label: L.wallU, value: areaWeighted(walls, (t) => t.u), unit: 'W/m²K', source: 'parameter' },
      { label: L.roofU, value: areaWeighted(roofs, (t) => t.u), unit: 'W/m²K', source: 'parameter' },
      ...glazing.types.map((t): InputValue => ({ label: C_ENV_TYPES.glazing.of(t.typeKey), value: glazingText(t), unit: 'U W/m²K, SHGC, VT', source: 'parameter', dbIds: t.dbIds })),
      ...walls.map((t): InputValue => ({ label: C_ENV_TYPES.wall.of(t.typeKey), value: t.u, unit: 'W/m²K', source: 'parameter', dbIds: t.dbIds })),
      ...roofs.map((t): InputValue => ({ label: C_ENV_TYPES.roof.of(t.typeKey), value: t.u, unit: 'W/m²K', source: 'parameter', dbIds: t.dbIds })),
    )
    pending.push(pendingFor(scope, [...windows.involved, ...shading.involved, ...glazing.involved, ...exterior.involved]))

    return measureResult('C-ENV', {
      inputs,
      ...(placement.unplaced ? { blockedBy: [unplacedBlocker(placement)] } : {}),
      ...(rows ? { orientations: rows } : {}),
      ...mergePending(pending),
    })
  },
}
