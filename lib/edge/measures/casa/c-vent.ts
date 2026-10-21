import { GLAZED_DOOR, OPENING_FACTORS, openingAreaM2, operableShare, roomBehind } from '../../casa/openings'
import { isHabitableName } from '../../casa/room-names'
import { RULES, reaches } from '../../casa/rules'
import { pendingFor, roomPlacement, scopeOf, select, typeGap, unplacedBlocker } from '../../casa/scope'
import { GUIDE } from '../../guide'
import { text } from '../../params'
import { roomIndexOf } from '../../rooms'
import type { Element, Gap, InputValue, Measure, MeasureBlocker, MeasureFlag } from '../../types'
import { deriveUnits } from '../../units'
import { tallyFacade } from '../eem01'
import { labelFamily } from '../labels'
import { measureResult } from '../result'

export const C_VENT_LABELS = {
  rooms: 'Dwelling rooms with an exterior opening',
  roomsAbove: 'Rooms with a useful opening above 4% of their floor area',
  lowestRoom: 'Lowest useful opening share over a room',
  closedRooms: 'Dwelling rooms with no exterior opening',
  unitRule: 'Dwelling unit rule',
  units: 'Dwelling units',
  unitsAtLeast: 'Units with glazing at 15% of their floor area or more',
  lowestUnit: 'Lowest glazing share over a unit',
} as const

/** SBc6 glazing share per unit and SBp1 useful opening share per room, one input each. */
export const C_VENT_ROWS = {
  unit: labelFamily('Unit ', ': glazing share of floor area'),
  room: labelFamily('Room ', ': useful opening share of floor area'),
} as const

function operableGaps(windows: Element[]): Gap[] {
  const byType = new Map<string, Element[]>()
  for (const w of windows) byType.set(w.typeKey, [...(byType.get(w.typeKey) ?? []), w])
  return [...byType].flatMap(([typeKey, list]) => {
    const share = operableShare(list[0])
    if (share?.source === 'parameter') return []
    const factor = OPENING_FACTORS.find((f) => f.name.test(typeKey))
    const message = share
      ? `${typeKey} has no Operable parameter. Its opening uses greenr's assumed share for a ${factor!.label} window, ${share.share}, until the type carries Operable.`
      : `${typeKey} has no Operable parameter and its name does not say how it opens, so it adds no useful opening.`
    return [typeGap('C-VENT', 'Operable', message, typeKey, list.map((w) => w.dbId))]
  })
}

/**
 * SBp1 Case A per dwelling room (useful opening over floor area) and SBc6 Option 2 Alternative 1 per unit (glazing over
 * floor area). Ratios and counts only; glazing VT gaps belong to C-GLAZE.
 */
export const C_VENT: Measure = {
  scheme: 'CASA',
  code: 'C-VENT',
  guide: GUIDE['C-VENT'],
  credits: ['SBp1', 'SBc6'],
  compute(snapshot, classifications, exclusions) {
    const L = C_VENT_LABELS
    const scope = scopeOf(snapshot, classifications, exclusions)
    const windows = select(scope, ['window'], /Windows/)
    const doors = select(scope, ['door'], /Doors/)
    const units = deriveUnits(snapshot)
    const inputs: InputValue[] = []
    const flags: MeasureFlag[] = []
    const gaps = operableGaps(windows.used)
    const blockedBy: MeasureBlocker[] = gaps.length ? [{ kind: 'missing-parameter', parameter: 'Operable' }] : []
    const placement = roomPlacement(snapshot)

    if (placement.unplaced) {
      blockedBy.push(unplacedBlocker(placement))
    } else {
      const index = roomIndexOf(snapshot)
      const unitRooms = new Set(units.flatMap((u) => u.roomDbIds))
      const dwelling = index.rooms.filter((r) => (unitRooms.size ? unitRooms.has(r.dbId) : isHabitableName(r.name)) && r.areaM2 > 0)
      const byId = new Map(snapshot.elements.map((e) => [e.dbId, e]))
      const open = new Map<number, number>()
      for (const op of tallyFacade(snapshot, classifications, exclusions).openings) {
        if (!op.counted || op.azimuthDeg === null || (op.role !== 'window' && op.role !== 'door')) continue
        const e = byId.get(op.dbId)!
        const share = operableShare(e)?.share ?? 0
        const room = roomBehind(e, op.azimuthDeg, index)
        if (room !== null) open.set(room, (open.get(room) ?? 0) + op.areaM2 * share)
      }
      const measured = dwelling.filter((r) => open.has(r.dbId)).map((r) => ({ room: r, share: open.get(r.dbId)! / r.areaM2 }))
      const above = measured.filter((m) => reaches(RULES.ventOpeningShare, m.share))
      const closed = dwelling.filter((r) => !open.has(r.dbId))
      inputs.push(
        { label: L.rooms, value: measured.length, unit: 'rooms', source: 'rooms', dbIds: measured.map((m) => m.room.dbId) },
        { label: L.roomsAbove, value: above.length, unit: 'rooms', source: 'mixed', dbIds: above.map((m) => m.room.dbId) },
        { label: L.lowestRoom, value: measured.length ? Math.min(...measured.map((m) => m.share)) : null, unit: 'ratio', source: 'mixed' },
        { label: L.closedRooms, value: closed.length, unit: 'rooms', source: 'rooms', dbIds: closed.map((r) => r.dbId) },
        ...measured.map(
          (m): InputValue => ({
            label: C_VENT_ROWS.room.of(`${m.room.name} ${text(byId.get(m.room.dbId)!.params, 'Number') ?? `#${m.room.dbId}`}`),
            value: m.share,
            unit: 'ratio',
            source: 'mixed',
            dbIds: [m.room.dbId],
          }),
        ),
      )
      if (above.length < measured.length) {
        flags.push({
          id: 'C-VENT:rooms',
          level: 'flag',
          threshold: RULES.ventOpeningShare.value,
          message: `${measured.length - above.length} of ${measured.length} rooms have a useful opening at or below 4% of their floor area.`,
          guide: RULES.ventOpeningShare.guide,
        })
      }
    }

    if (units.length === 0) {
      blockedBy.push({ kind: 'missing-elements', elements: 'dwelling-unit' })
    } else {
      const used = new Map([...windows.used, ...doors.used.filter((d) => GLAZED_DOOR.test(d.typeKey))].map((e) => [e.dbId, e]))
      const shares = units.map((u) => {
        const glass = [...u.windowDbIds, ...u.doorDbIds].flatMap((id) => used.get(id) ?? [])
        const glazing = glass.reduce((s, e) => s + openingAreaM2(e), 0)
        return { unit: u, dbIds: glass.map((e) => e.dbId), share: u.areaM2 > 0 ? glazing / u.areaM2 : null }
      })
      const measured = shares.filter((s): s is typeof s & { share: number } => s.share !== null)
      const atLeast = measured.filter((s) => reaches(RULES.unitGlazingShare, s.share))
      inputs.push(
        { label: L.unitRule, value: units[0].source, unit: 'rule', source: units[0].source === 'comments-tipo' ? 'parameter' : 'rooms' },
        { label: L.units, value: units.length, unit: 'units', source: 'mixed' },
        { label: L.unitsAtLeast, value: atLeast.length, unit: 'units', source: 'mixed' },
        { label: L.lowestUnit, value: measured.length ? Math.min(...measured.map((s) => s.share)) : null, unit: 'ratio', source: 'mixed' },
        ...shares.map((s): InputValue => ({ label: C_VENT_ROWS.unit.of(s.unit.label), value: s.share, unit: 'ratio', source: 'mixed', dbIds: s.dbIds })),
      )
      if (atLeast.length < measured.length) {
        flags.push({
          id: 'C-VENT:units',
          level: 'flag',
          threshold: RULES.unitGlazingShare.value,
          message: `${measured.length - atLeast.length} of ${measured.length} units have glazing under 15% of their floor area.`,
          guide: RULES.unitGlazingShare.guide,
        })
      }
    }

    return measureResult('C-VENT', { inputs, gaps, flags, blockedBy, ...pendingFor(scope, [...windows.involved, ...doors.involved]) })
  },
}
