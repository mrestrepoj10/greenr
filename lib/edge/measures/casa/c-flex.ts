import { isHabitableName } from '../../casa/room-names'
import { RULES, reaches } from '../../casa/rules'
import { blockedOn, mergePending, pendingFor, scopeOf, select } from '../../casa/scope'
import { GUIDE } from '../../guide'
import { param, text } from '../../params'
import type { Element, Gap, InputValue, Measure, MeasureFlag, Snapshot, ValueSource } from '../../types'
import { deriveUnits, type Unit } from '../../units'
import { buildingOf, type Building } from '../building'
import { measureResult } from '../result'

export const C_FLEX_LABELS = {
  partitions: 'Interior partition wall area, finish layers left out',
  nonStructural: 'Non-structural partition area',
  structural: 'Structural partition area',
  unknown: 'Partition area with no Structural or Structural Usage',
  share: 'Non-structural share of partition wall area',
  skins: 'Finish layers left out',
  spaces: 'Dwelling spaces with a slab-to-slab height',
  minHeight: 'Minimum slab-to-slab height over dwelling spaces',
  below: 'Dwelling spaces under 2.40 m slab to slab',
} as const

/** TORRE A models plaster, paint and render as walls 2 to 20 mm thick (22,770 of 31,879); they are not partitions. */
const FINISH_LAYER_MAX_M = 0.03

type Bearing = 'structural' | 'non-structural' | 'unknown'

/** Non-structural when `Structural` is No or `Structural Usage` is Non-bearing, as Mc4 alternative b reads it. */
function bearingOf(e: Element): Bearing {
  const usage = text(e.params, 'Structural Usage')?.toLowerCase() ?? null
  const flag = param(e.params, 'Structural')
  const structural = flag === null || flag === undefined ? null : /^(1|yes|s[ií]|true)$/i.test(String(flag).trim())
  if (structural === false || usage === 'non-bearing') return 'non-structural'
  if (structural === true || usage !== null) return 'structural'
  return 'unknown'
}

type Space = { dbIds: number[]; heightM: number }

/** Slab to slab per unit (its lowest room), per habitable room when no unit is found, or per unit level when rooms are unplaced. */
function slabHeights(snapshot: Snapshot, b: Building, units: Unit[]): { spaces: Space[]; source: ValueSource } {
  const ff = b.ff.byRoom
  if (ff.size > 0) {
    const roomUnits = units.filter((u) => u.roomDbIds.some((id) => ff.has(id)))
    if (roomUnits.length) {
      return {
        spaces: roomUnits.map((u) => ({ dbIds: u.roomDbIds, heightM: Math.min(...u.roomDbIds.flatMap((id) => ff.get(id) ?? [])) })),
        source: 'rooms',
      }
    }
    const habitable = b.rooms.rooms.filter((r) => ff.has(r.dbId) && isHabitableName(r.name))
    return { spaces: habitable.map((r) => ({ dbIds: [r.dbId], heightM: ff.get(r.dbId)! })), source: 'rooms' }
  }
  const z = new Map(snapshot.levels.map((l) => [l.name, l.elevation]))
  const unitZ = [...new Set(units.map((u) => z.get(u.level)).filter((e): e is number => e !== undefined))].sort((x, y) => x - y)
  const above = (e: number) => unitZ.find((x) => x > e + 1e-6)
  const spaces = units.flatMap((u) => {
    const e = z.get(u.level)
    const next = e === undefined ? undefined : above(e)
    return e === undefined || next === undefined ? [] : [{ dbIds: u.floorDbIds, heightM: next - e }]
  })
  return { spaces, source: 'levels' }
}

/** Mc4 alternative b: over 50% of partition wall area non-structural, and at least 2.40 m between slabs. */
export const C_FLEX: Measure = {
  scheme: 'CASA',
  code: 'C-FLEX',
  guide: GUIDE['C-FLEX'],
  credits: ['Mc4'],
  compute(snapshot, classifications, exclusions) {
    const L = C_FLEX_LABELS
    const scope = scopeOf(snapshot, classifications, exclusions)
    const walls = select(scope, ['interior-wall'], /Walls/)
    const thickness = (w: Element) => w.width ?? w.facade?.thickness ?? Infinity
    const skins = walls.used.filter((w) => thickness(w) < FINISH_LAYER_MAX_M)
    const partitions = walls.used.filter((w) => thickness(w) >= FINISH_LAYER_MAX_M)
    const area = (list: Element[]) => list.reduce((s, w) => s + (w.area ?? 0), 0)
    const by: Record<Bearing, Element[]> = { structural: [], 'non-structural': [], unknown: [] }
    for (const w of partitions) by[bearingOf(w)].push(w)
    const known = area(by.structural) + area(by['non-structural'])
    const share = known > 0 ? area(by['non-structural']) / known : null

    const gaps: Gap[] = []
    const flags: MeasureFlag[] = []
    if (partitions.length === 0) {
      gaps.push(blockedOn('C-FLEX', 'Interior partitions', 'No wall at least 3 cm thick is classified interior-wall, so there is no partition area to split.'))
    }
    const unknownTypes = new Map<string, number[]>()
    for (const w of by.unknown) unknownTypes.set(w.typeKey, [...(unknownTypes.get(w.typeKey) ?? []), w.dbId])
    for (const [typeKey, dbIds] of unknownTypes) {
      const gap = blockedOn('C-FLEX', 'Structural or Structural Usage', `${typeKey} has neither Structural nor Structural Usage, so its ${dbIds.length} walls are left out of the share.`, typeKey, dbIds)
      gaps.push(known > 0 ? { ...gap, severity: 'info' } : gap)
    }
    if (share !== null && !reaches(RULES.nonStructuralShare, share)) {
      flags.push({ id: 'C-FLEX:share', level: 'flag', threshold: RULES.nonStructuralShare.value, message: 'Non-structural partitions are 50% of partition wall area or less.', guide: RULES.nonStructuralShare.guide })
    }

    const b = buildingOf(snapshot, classifications, exclusions)
    const { spaces, source } = slabHeights(snapshot, b, deriveUnits(snapshot))
    const under = spaces.filter((s) => !reaches(RULES.slabToSlabM, s.heightM))
    if (spaces.length === 0) {
      gaps.push(blockedOn('C-FLEX', 'Placed rooms or dwelling units', 'No dwelling room found a slab above it and no two levels carry dwelling units, so the height between slabs is not measured.'))
    }
    if (under.length) {
      flags.push({ id: 'C-FLEX:height', level: 'flag', threshold: RULES.slabToSlabM.value, message: `${under.length} of ${spaces.length} dwelling spaces are under 2.40 m slab to slab.`, guide: RULES.slabToSlabM.guide })
    }

    const inputs: InputValue[] = [
      { label: L.partitions, value: area(partitions), unit: 'm²', source: 'parameter' },
      { label: L.nonStructural, value: area(by['non-structural']), unit: 'm²', source: 'parameter' },
      { label: L.structural, value: area(by.structural), unit: 'm²', source: 'parameter', dbIds: by.structural.map((w) => w.dbId) },
      { label: L.unknown, value: area(by.unknown), unit: 'm²', source: 'parameter' },
      { label: L.share, value: share, unit: 'ratio', source: 'parameter' },
      { label: L.skins, value: area(skins), unit: 'm²', source: 'parameter' },
      { label: L.spaces, value: spaces.length, unit: 'spaces', source },
      { label: L.minHeight, value: spaces.length ? Math.min(...spaces.map((s) => s.heightM)) : null, unit: 'm', source },
      { label: L.below, value: under.length, unit: 'spaces', source, dbIds: under.flatMap((s) => s.dbIds) },
    ]
    const slabs = source === 'rooms' ? [{ pendingTypeKeys: b.pendingTypeKeys, pendingExclusionIds: b.pendingExclusionIds }] : []
    return measureResult('C-FLEX', { inputs, gaps, flags, ...mergePending([pendingFor(scope, walls.involved), ...slabs]) })
  },
}
