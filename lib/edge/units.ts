import { roomsEitherSide } from './casa/openings'
import { isBedroomName, isOutdoorRoomName } from './casa/room-names'
import { text } from './params'
import { roomIndexOf, roomName } from './rooms'
import { UNIT_SOURCES, type DwellingSummary, type Element, type Snapshot, type UnitSource } from './types'

export type Unit = {
  key: string
  level: string
  label: string
  roomDbIds: number[]
  floorDbIds: number[]
  windowDbIds: number[]
  doorDbIds: number[]
  bedrooms: number
  areaM2: number
  source: UnitSource
}

/** CASA GGp8 p. 48: inhabitants per dwelling are bedrooms plus one, the same in every calculation. */
export const occupantsOf = (unit: Unit): number => unit.bedrooms + 1

type Member = 'room' | 'floor' | 'window' | 'door'

const MEMBER_CATEGORY: [RegExp, Member][] = [
  [/Rooms/, 'room'],
  [/Floors/, 'floor'],
  [/Windows/, 'window'],
  [/Doors/, 'door'],
]

const memberOf = (e: Element): Member | null => MEMBER_CATEGORY.find(([re]) => re.test(e.category))?.[1] ?? null
const levelOf = (e: Element): string | null => e.level || text(e.params, 'Level') || text(e.params, 'Base Constraint')
const placed = (e: Element): boolean => e.footprint !== undefined && (e.area ?? 0) > 0
const nameOf = (e: Element): string => e.typeName ?? e.typeKey

type Draft = { key: string; level: string; label: string; members: Record<Member, Element[]>; areaM2?: number }

const draft = (key: string, level: string, label: string): Draft => ({ key, level, label, members: { room: [], floor: [], window: [], door: [] } })

/**
 * Bedrooms count named rooms; with no placed rooms they count finish-floor pieces named for a bedroom, which TORRE A
 * models one per space. Area sums the indoor rooms; with none, the floor type covering most of the unit, so a screed
 * under the finishes is not counted twice.
 */
function finish(d: Draft, source: UnitSource): Unit {
  const rooms = d.members.room.filter((r) => !isOutdoorRoomName(roomName(r)))
  const indoorFloors = d.members.floor.filter((f) => !isOutdoorRoomName(nameOf(f)))
  const bedrooms = rooms.length
    ? rooms.filter((r) => isBedroomName(roomName(r))).length
    : indoorFloors.filter((f) => isBedroomName(nameOf(f))).length
  const byType = new Map<string, number>()
  for (const f of indoorFloors) byType.set(f.typeKey, (byType.get(f.typeKey) ?? 0) + (f.area ?? 0))
  const areaM2 = d.areaM2 ?? (rooms.length ? rooms.reduce((s, r) => s + (r.area ?? 0), 0) : Math.max(0, ...byType.values()))
  const ids = (m: Member) => d.members[m].map((e) => e.dbId)
  return {
    key: d.key,
    level: d.level,
    label: d.label,
    roomDbIds: ids('room'),
    floorDbIds: ids('floor'),
    windowDbIds: ids('window'),
    doorDbIds: ids('door'),
    bedrooms,
    areaM2,
    source,
  }
}

const TIPO = /^\s*(?:apto\.?\s*)?tipo\s*(\d+)\s*$/i

/** TORRE A: `Comments` holds the unit typology ("Tipo 3", "Apto tipo 3"), so the instance is that typology on one level. */
function byCommentsTipo(snapshot: Snapshot): Draft[] {
  const drafts = new Map<string, Draft>()
  for (const e of snapshot.elements) {
    const member = memberOf(e)
    if (!member || (member === 'room' && !placed(e))) continue
    const tipo = TIPO.exec(text(e.params, 'Comments') ?? '')
    const level = levelOf(e)
    if (!tipo || !level) continue
    const label = `${level} Tipo ${Number(tipo[1])}`
    const d = drafts.get(label) ?? draft(label, level, label)
    d.members[member].push(e)
    drafts.set(label, d)
  }
  return [...drafts.values()]
}

/** Room-keyed rules group placed rooms, then give each unit the windows and doors that touch one of its rooms. */
function byRooms(snapshot: Snapshot, keyOf: (room: Element) => string | null): Draft[] {
  const drafts = new Map<string, Draft>()
  const unitOfRoom = new Map<number, Draft>()
  for (const e of snapshot.elements) {
    if (memberOf(e) !== 'room' || !placed(e)) continue
    const key = keyOf(e)
    const level = levelOf(e)
    if (!key || !level) continue
    const d = drafts.get(key) ?? draft(key, level, key)
    d.members.room.push(e)
    drafts.set(key, d)
    unitOfRoom.set(e.dbId, d)
  }
  if (drafts.size === 0) return []
  const index = roomIndexOf(snapshot)
  for (const e of snapshot.elements) {
    const member = memberOf(e)
    if (member !== 'window' && member !== 'door') continue
    const units = new Set(roomsEitherSide(e, index).flatMap((id) => unitOfRoom.get(id) ?? []))
    for (const d of units) d.members[member].push(e)
  }
  return [...drafts.values()]
}

/** "501-2" and "A-101.3" are rooms 2 and 3 of units 501 and A-101. A bare "12" names no unit. */
const NUMBER_PREFIX = /^(.+?)\s*[-_.]\s*[^-_.\s]+$/

const byRoomNumber = (snapshot: Snapshot) => byRooms(snapshot, (room) => NUMBER_PREFIX.exec(text(room.params, 'Number') ?? '')?.[1] ?? null)

const byDepartment = (snapshot: Snapshot) =>
  byRooms(snapshot, (room) => {
    const department = text(room.params, 'Department')
    const level = levelOf(room)
    return department && level ? `${level} ${department}` : null
  })

/** Revit Areas drawn per dwelling: each area is a unit and holds the placed rooms whose centre lies inside it. */
function byAreas(snapshot: Snapshot): Draft[] {
  const areas = snapshot.elements.flatMap((e) =>
    /Areas/.test(e.category) && e.area && e.bbox
      ? [{ key: `${levelOf(e) ?? ''} ${text(e.params, 'Name') ?? text(e.params, 'Number') ?? e.dbId}`.trim(), areaM2: e.area, b: e.bbox }]
      : [],
  )
  const containing = (room: Element): string | null => {
    const r = room.bbox
    if (!r) return null
    const [x, y, z] = [(r[0] + r[3]) / 2, (r[1] + r[4]) / 2, r[2]]
    return areas.find(({ b }) => x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] - 0.5 && z <= b[5] + 0.5)?.key ?? null
  }
  const areaOf = new Map(areas.map((a) => [a.key, a.areaM2]))
  return byRooms(snapshot, containing).map((d) => ({ ...d, areaM2: areaOf.get(d.key) }))
}

const RULES: Record<UnitSource, (snapshot: Snapshot) => Draft[]> = {
  'comments-tipo': byCommentsTipo,
  'room-number': byRoomNumber,
  department: byDepartment,
  areas: byAreas,
}

const cache = new WeakMap<Snapshot, Unit[]>()

export function dwellingSummary(units: Unit[]): DwellingSummary {
  const byBedrooms = new Map<number, number>()
  for (const u of units) byBedrooms.set(u.bedrooms, (byBedrooms.get(u.bedrooms) ?? 0) + 1)
  return {
    count: units.length,
    source: units[0]?.source ?? null,
    bedrooms: [...byBedrooms].sort((a, b) => a[0] - b[0]).map(([bedrooms, count]) => ({ bedrooms, units: count })),
  }
}

/** The dwelling units of a residential model, by the first rule in `UNIT_SOURCES` that finds any. Empty when none does. */
export function deriveUnits(snapshot: Snapshot): Unit[] {
  const hit = cache.get(snapshot)
  if (hit) return hit
  let units: Unit[] = []
  for (const source of UNIT_SOURCES) {
    const drafts = RULES[source](snapshot)
    if (drafts.length === 0) continue
    units = drafts.map((d) => finish(d, source)).sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }))
    break
  }
  cache.set(snapshot, units)
  return units
}
