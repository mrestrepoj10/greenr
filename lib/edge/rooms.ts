import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds'
import type { Element, Snapshot } from './types'

export type Room = {
  dbId: number
  name: string
  areaM2: number
  level: string | undefined
  baseOffset: number
  zmin: number
  zmax: number
  x0: number
  x1: number
  y0: number
  y1: number
  triangles: readonly number[]
}

export type PlanBounds = { x0: number; x1: number; y0: number; y1: number }

export type RoomIndex = {
  rooms: Room[]
  gradeZ: number
  bounds: PlanBounds
}

/**
 * Set to 1 by the snapshot reader on a room with no area and no level: Revit keeps a room that was deleted from
 * plan, or never placed, in the model. TORRE A has 73 rooms and all are unplaced.
 */
export const UNPLACED_PARAM = '__unplaced'

const WET_ROOM = /ba[ñn]o|ducha|cocina|lavander|ropas|bath|kitchen|laundry|toilet/i
const BEDROOM = /alcoba|habitaci[oó]n|dormitorio|cuarto|bedroom/i

export function roomName(element: Element): string {
  const name = element.params.Name
  return typeof name === 'string' && name ? name : (element.family ?? '')
}

export const isWetRoomName = (name: string): boolean => WET_ROOM.test(name)
/** A "cuarto de baño" is a bathroom, so a wet-room name is never a bedroom. */
export const isBedroomName = (name: string): boolean => BEDROOM.test(name) && !isWetRoomName(name)
export const isOutdoorRoomName = (name: string, t: Thresholds = DEFAULT_THRESHOLDS): boolean => t.outdoorRoomName.test(name)
export const isUnplacedRoom = (element: Element): boolean => element.params[UNPLACED_PARAM] === 1

export function isIndoorRoom(element: Element, t: Thresholds): boolean {
  return element.footprint !== undefined && !isOutdoorRoomName(roomName(element), t)
}

const cache = new WeakMap<Snapshot, RoomIndex>()

export function roomIndexOf(snapshot: Snapshot, t: Thresholds = DEFAULT_THRESHOLDS): RoomIndex {
  if (t !== DEFAULT_THRESHOLDS) return buildRoomIndex(snapshot, t)
  const hit = cache.get(snapshot)
  if (hit) return hit
  const index = buildRoomIndex(snapshot, t)
  cache.set(snapshot, index)
  return index
}

function buildRoomIndex(snapshot: Snapshot, t: Thresholds): RoomIndex {
  const rooms: Room[] = []
  for (const element of snapshot.elements) {
    const fp = element.footprint
    if (!fp || !isIndoorRoom(element, t)) continue
    const [x0, y0, , x1, y1] = element.bbox ?? planExtent(fp.triangles)
    rooms.push({
      dbId: element.dbId,
      name: roomName(element),
      areaM2: element.area ?? 0,
      level: element.level,
      baseOffset: fp.baseOffset,
      zmin: fp.zmin,
      zmax: fp.zmax,
      x0,
      x1,
      y0,
      y1,
      triangles: fp.triangles,
    })
  }
  return { rooms, gradeZ: gradeZ(rooms, snapshot), bounds: boundsOf(rooms) }
}

function gradeZ(rooms: Room[], snapshot: Snapshot): number {
  const elevation = new Map(snapshot.levels.map((l) => [l.name, l.elevation]))
  const offsets = rooms
    .filter((r) => r.level !== undefined && elevation.has(r.level))
    .map((r) => r.zmin - (elevation.get(r.level!)! + r.baseOffset))
    .sort((a, b) => a - b)
  if (offsets.length > 0) return offsets[Math.floor(offsets.length / 2)]
  return rooms.length > 0 ? Math.min(...rooms.map((r) => r.zmin)) : 0
}

function boundsOf(rooms: Room[]): PlanBounds {
  if (rooms.length === 0) return { x0: 0, x1: 0, y0: 0, y1: 0 }
  return {
    x0: Math.min(...rooms.map((r) => r.x0)),
    x1: Math.max(...rooms.map((r) => r.x1)),
    y0: Math.min(...rooms.map((r) => r.y0)),
    y1: Math.max(...rooms.map((r) => r.y1)),
  }
}

function planExtent(tri: readonly number[]): [number, number, number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < tri.length; i += 2) {
    x0 = Math.min(x0, tri[i])
    x1 = Math.max(x1, tri[i])
    y0 = Math.min(y0, tri[i + 1])
    y1 = Math.max(y1, tri[i + 1])
  }
  return [x0, y0, 0, x1, y1, 0]
}

function inTriangle(px: number, py: number, t: readonly number[], i: number): boolean {
  const d1 = (px - t[i + 2]) * (t[i + 1] - t[i + 3]) - (t[i] - t[i + 2]) * (py - t[i + 3])
  const d2 = (px - t[i + 4]) * (t[i + 3] - t[i + 5]) - (t[i + 2] - t[i + 4]) * (py - t[i + 5])
  const d3 = (px - t[i]) * (t[i + 5] - t[i + 1]) - (t[i + 4] - t[i]) * (py - t[i + 1])
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

export function inFootprint(room: Room, x: number, y: number): boolean {
  if (x < room.x0 || x > room.x1 || y < room.y0 || y > room.y1) return false
  for (let i = 0; i < room.triangles.length; i += 6) if (inTriangle(x, y, room.triangles, i)) return true
  return false
}

export function roomAt(index: RoomIndex, x: number, y: number, z: number): number | null {
  for (const room of index.rooms) {
    if (z < room.zmin || z > room.zmax) continue
    if (inFootprint(room, x, y)) return room.dbId
  }
  return null
}
