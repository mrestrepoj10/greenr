import { elevationZeroZ } from '../../casa/elevation'
import { isHabitableName } from '../../casa/room-names'
import { RULES, reaches } from '../../casa/rules'
import { pendingFor, scopeOf, select } from '../../casa/scope'
import { GUIDE } from '../../guide'
import { text } from '../../params'
import { roomIndexOf } from '../../rooms'
import type { Element, Gap, InputValue, Measure, MeasureBlocker, MeasureFlag, ProjectInputKey, Snapshot, ValueSource } from '../../types'
import { deriveUnits } from '../../units'
import { measureResult } from '../result'

export const C_FLOOD_LABELS = {
  spaces: 'Habitable spaces checked',
  lowest: 'Lowest habitable floor, survey datum',
  lowestMinusRoad: 'Lowest habitable floor minus road grade',
  belowRoad: 'Habitable spaces with their floor below road grade',
  atOrBelowFlood: 'Habitable spaces with their floor at or below the flood elevation',
  windowsBelowFlood: 'Window sills below the flood elevation',
  doorsBelowFlood: 'Door sills below the flood elevation',
  entry: 'Entry level, lowest exterior door sill, survey datum',
  entryMinusFlood: 'Entry level minus flood elevation',
} as const

const REQUIRED: ProjectInputKey[] = ['roadGradeM', 'floodElevationM', 'floodReturnYears']

/** A habitable floor at one elevation: a placed room, or, with no placed rooms, the units on one level. */
type Space = { dbIds: number[]; z: number }

/** Elevations are in the level frame: model z less `zeroZ`, the z of level elevation 0. */
function habitableSpaces(snapshot: Snapshot, removed: ReadonlySet<number>, zeroZ: number): { spaces: Space[]; source: ValueSource } {
  const rooms = roomIndexOf(snapshot).rooms.filter((r) => isHabitableName(r.name) && !removed.has(r.dbId))
  if (rooms.length) return { spaces: rooms.map((r) => ({ dbIds: [r.dbId], z: r.zmin - zeroZ })), source: 'rooms' }
  const elevation = new Map(snapshot.levels.map((l) => [l.name, l.elevation]))
  const byLevel = new Map<string, number[]>()
  for (const u of deriveUnits(snapshot)) byLevel.set(u.level, [...(byLevel.get(u.level) ?? []), ...u.floorDbIds, ...u.roomDbIds])
  const spaces = [...byLevel].flatMap(([level, dbIds]) => (elevation.has(level) ? [{ dbIds, z: elevation.get(level)! }] : []))
  return { spaces, source: 'levels' }
}

export const C_FLOOD: Measure = {
  scheme: 'CASA',
  code: 'C-FLOOD',
  guide: GUIDE['C-FLOOD'],
  credits: ['CCRp3', 'CCRc4'],
  compute(snapshot, classifications, exclusions, inputs) {
    const scope = scopeOf(snapshot, classifications, exclusions)
    const datum = inputs.datumOffsetM ?? 0
    const survey = (z: number) => z + datum
    const zeroZ = elevationZeroZ(snapshot)
    const sill = (e: Element): number | null => (e.bbox ? e.bbox[2] - zeroZ : null)
    const L = C_FLOOD_LABELS
    const blockedBy: MeasureBlocker[] = REQUIRED.filter((input) => inputs[input] === undefined).map((input) => ({ kind: 'missing-input', input }))
    const windows = select(scope, ['window'], /Windows/)
    const doors = select(scope, ['door'], /Doors/)
    const { spaces, source } = habitableSpaces(snapshot, scope.applied.removed, zeroZ)
    const ids = (list: Space[]) => list.flatMap((s) => s.dbIds)
    const gaps: Gap[] = []
    const out: InputValue[] = [{ label: L.spaces, value: spaces.length, unit: 'spaces', source, dbIds: ids(spaces) }]

    if (spaces.length === 0) blockedBy.push({ kind: 'missing-elements', elements: 'habitable-space' })
    const lowestZ = spaces.length ? Math.min(...spaces.map((s) => s.z)) : null
    if (lowestZ !== null) out.push({ label: L.lowest, value: survey(lowestZ), unit: 'm', source, dbIds: ids(spaces.filter((s) => s.z === lowestZ)) })

    const road = inputs.roadGradeM
    if (road !== undefined && lowestZ !== null) {
      const below = spaces.filter((s) => survey(s.z) < road)
      out.push(
        { label: L.lowestMinusRoad, value: survey(lowestZ) - road, unit: 'm', source },
        { label: L.belowRoad, value: below.length, unit: 'spaces', source, dbIds: ids(below) },
      )
    }

    const flood = inputs.floodElevationM
    if (flood !== undefined) {
      const under = (list: Element[]) => list.filter((e) => sill(e) !== null && survey(sill(e)!) < flood)
      const atOrBelow = spaces.filter((s) => survey(s.z) <= flood)
      const windowsUnder = under(windows.used)
      const doorsUnder = under(doors.used)
      out.push(
        { label: L.atOrBelowFlood, value: atOrBelow.length, unit: 'spaces', source, dbIds: ids(atOrBelow) },
        { label: L.windowsBelowFlood, value: windowsUnder.length, unit: 'windows', source: 'geometry', dbIds: windowsUnder.map((e) => e.dbId) },
        { label: L.doorsBelowFlood, value: doorsUnder.length, unit: 'doors', source: 'geometry', dbIds: doorsUnder.map((e) => e.dbId) },
      )
      const exterior = doors.used.filter((d) => text(d.params, 'Function') === 'Exterior' && sill(d) !== null)
      if (exterior.length) {
        const entryZ = Math.min(...exterior.map((d) => sill(d)!))
        const entryDoors = exterior.filter((d) => sill(d)! - entryZ < 0.05).map((d) => d.dbId)
        out.push(
          { label: L.entry, value: survey(entryZ), unit: 'm', source: 'mixed', dbIds: entryDoors },
          { label: L.entryMinusFlood, value: survey(entryZ) - flood, unit: 'm', source: 'mixed', dbIds: entryDoors },
        )
      } else {
        gaps.push({
          id: 'C-FLOOD:entry',
          measure: 'C-FLOOD',
          typeKey: '',
          dbIds: [],
          missing: 'Function = Exterior on doors',
          severity: 'info',
          message: 'No door has Function = Exterior, so the entry level for CCRc4 is not found.',
        })
      }
    }

    const flags: MeasureFlag[] = []
    const years = inputs.floodReturnYears
    if (inputs.inFloodplain && years !== undefined && !reaches(RULES.floodplainReturnYears, years)) {
      flags.push({
        id: 'C-FLOOD:return-period',
        level: 'flag',
        threshold: RULES.floodplainReturnYears.value,
        message: `The site is in a floodplain, where CCRp3 and CCRc4 take the 100-year flood elevation; the typed elevation is ${years}-year.`,
        guide: RULES.floodplainReturnYears.guide,
      })
    }

    return measureResult('C-FLOOD', {
      inputs: out,
      gaps,
      flags,
      ...(blockedBy.length ? { blockedBy } : {}),
      ...pendingFor(scope, [...windows.involved, ...doors.involved]),
    })
  },
}
