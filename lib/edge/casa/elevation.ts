import { roomIndexOf } from '../rooms'
import type { Snapshot } from '../types'

/**
 * The model z where level elevation 0 sits. Viewer geometry can sit far from the level elevations (210 King by
 * -18.96 m), so sills and heights are read against this datum, never against z = 0. Rooms on known levels give it as
 * the room index computes grade; without them, the median of floor tops less their level's elevation.
 */
export function elevationZeroZ(snapshot: Snapshot): number {
  const elevation = new Map(snapshot.levels.map((l) => [l.name, l.elevation]))
  const rooms = roomIndexOf(snapshot)
  if (rooms.rooms.some((r) => r.level !== undefined && elevation.has(r.level))) return rooms.gradeZ
  const offsets = snapshot.elements
    .flatMap((e) => (/Floors/.test(e.category) && e.bbox && e.level && elevation.has(e.level) ? [e.bbox[5] - elevation.get(e.level)!] : []))
    .sort((a, b) => a - b)
  return offsets.length ? offsets[Math.floor(offsets.length / 2)] : 0
}
