import { inFootprint, type Room, type RoomIndex } from './rooms'
import type { Thresholds } from './thresholds'
import type { Element } from './types'

export type FloorToFloor = {
  /** Per room dbId, the height from its floor to the nearest slab top above it, metres. */
  byRoom: Map<number, number>
  /** Area-weighted over the rooms that found a slab, metres. */
  averageM: number
  roomsMeasured: number
}

/** Finished floor to finished floor, per room: the nearest Floor or Roof slab whose top is above the room's base. */
export function floorToFloor(rooms: RoomIndex, slabs: Element[], t: Thresholds): FloorToFloor {
  const byRoom = new Map<number, number>()
  let weighted = 0
  let area = 0
  for (const room of rooms.rooms) {
    if (!room.areaM2) continue
    const cx = (room.x0 + room.x1) / 2
    const cy = (room.y0 + room.y1) / 2
    let above = Infinity
    for (const slab of slabs) {
      const b = slab.bbox
      if (!b || cx < b[0] || cx > b[3] || cy < b[1] || cy > b[4]) continue
      if (b[5] > room.zmin + t.slabClearanceM && b[5] < above) above = b[5]
    }
    if (above === Infinity) continue
    const ff = above - room.zmin
    byRoom.set(room.dbId, ff)
    weighted += ff * room.areaM2
    area += room.areaM2
  }
  return { byRoom, averageM: area > 0 ? weighted / area : t.fallbackFloorToFloorM, roomsMeasured: byRoom.size }
}

export type StoreyCount = {
  /** Area-weighted over the plan grid. */
  aboveWeighted: number
  belowWeighted: number
  /** EDGE rounds the weighted average half up: 1.4 is 1 floor, 1.5 is 2. */
  above: number
  below: number
  maxAbove: number
  /** Plan area covered by indoor rooms, m². */
  footprintM2: number
}

export const edgeRound = (x: number) => Math.floor(x + 0.5)

/**
 * Storeys on a plan grid: each cell counts the distinct room floor levels above it. A storey is below grade when
 * more than half its height is below ground (EDGE Part 2), that is when base + floor-to-floor / 2 is below grade.
 */
export function countStoreys(rooms: RoomIndex, ff: FloorToFloor, t: Thresholds): StoreyCount {
  const step = t.storeyGridM
  const { x0, x1, y0, y1 } = rooms.bounds
  const nx = rooms.rooms.length ? Math.floor((x1 - x0) / step + 1e-9) + 1 : 0
  const ny = rooms.rooms.length ? Math.floor((y1 - y0) / step + 1e-9) + 1 : 0
  let cells = 0
  let sumAbove = 0
  let sumBelow = 0
  let maxAbove = 0
  for (let i = 0; i < nx; i++) {
    const x = x0 + i * step
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * step
      const bases = new Map<number, number>()
      for (const room of rooms.rooms) {
        if (!inFootprint(room, x, y)) continue
        bases.set(roundBase(room, rooms.gradeZ, t), ff.byRoom.get(room.dbId) || ff.averageM)
      }
      if (bases.size === 0) continue
      cells++
      let above = 0
      for (const [base, height] of bases) if (base + height / 2 >= 0) above++
      sumAbove += above
      sumBelow += bases.size - above
      maxAbove = Math.max(maxAbove, above)
    }
  }
  const aboveWeighted = cells ? sumAbove / cells : 0
  const belowWeighted = cells ? sumBelow / cells : 0
  return {
    aboveWeighted,
    belowWeighted,
    above: edgeRound(aboveWeighted),
    below: edgeRound(belowWeighted),
    maxAbove,
    footprintM2: cells * step * step,
  }
}

function roundBase(room: Room, gradeZ: number, t: Thresholds): number {
  return Math.round((room.zmin - gradeZ) / t.storeyBaseRoundM) * t.storeyBaseRoundM
}
