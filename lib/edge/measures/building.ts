import { applyExclusions, touching } from '../exclusions'
import { pendingOf, roleIndex } from '../roles'
import { roomIndexOf, type RoomIndex } from '../rooms'
import { countStoreys, floorToFloor, type FloorToFloor, type StoreyCount } from '../storeys'
import { DEFAULT_THRESHOLDS } from '../thresholds'
import type { Classification, Element, Exclusion, Snapshot } from '../types'

export type Building = {
  rooms: RoomIndex
  /** Floor and roof elements that bound storeys, after confirmed massing and user exclusions. */
  slabs: Element[]
  roofs: Element[]
  ff: FloorToFloor
  storeys: StoreyCount
  pendingTypeKeys: string[]
  pendingExclusionIds: string[]
}

const last = new WeakMap<Snapshot, { classifications: Classification[]; exclusions: Exclusion[]; building: Building }>()

/** Rooms, slabs and storeys shared by the design-tab measures. A run passes the same arrays to every measure, so the last result is reused. */
export function buildingOf(snapshot: Snapshot, classifications: Classification[], exclusions: Exclusion[]): Building {
  const hit = last.get(snapshot)
  if (hit && hit.classifications === classifications && hit.exclusions === exclusions) return hit.building
  const building = computeBuilding(snapshot, classifications, exclusions)
  last.set(snapshot, { classifications, exclusions, building })
  return building
}

function computeBuilding(snapshot: Snapshot, classifications: Classification[], exclusions: Exclusion[]): Building {
  const t = DEFAULT_THRESHOLDS
  const rooms = roomIndexOf(snapshot)
  const roles = roleIndex(classifications)
  const applied = applyExclusions(exclusions, ['massing', 'user'])
  const slabCandidates = snapshot.elements.filter((e) => {
    const category = /Floors|Roofs/.test(e.category)
    const role = roles.roleOf(e)
    return category || role === 'floor' || role === 'roof'
  })
  const slabs = slabCandidates.filter((e) => {
    const role = roles.roleOf(e)
    return (role === 'floor' || role === 'roof') && !applied.removed.has(e.dbId) && e.bbox
  })
  const ff = floorToFloor(rooms, slabs, t)
  return {
    rooms,
    slabs,
    roofs: slabs.filter((e) => roles.roleOf(e) === 'roof'),
    ff,
    storeys: countStoreys(rooms, ff, t),
    pendingTypeKeys: pendingOf(
      slabCandidates.map((e) => e.typeKey),
      roles,
    ),
    pendingExclusionIds: touching(applied.unconfirmed, new Set(slabCandidates.map((e) => e.dbId))),
  }
}
