import { analyzeEnvelope, type WallProbe } from './envelope'
import { FACADE_WALL_ROLES, roleIndex } from './roles'
import type { Classification, Exclusion, ExclusionReason, Snapshot } from './types'

export type PortionReason = 'below-grade' | 'party-wall' | 'parapet' | 'shaft'

export const KEEP: Record<PortionReason, (wall: WallProbe) => number> = {
  'below-grade': (w) => w.aboveGradeFrac,
  'party-wall': (w) => 1 - w.partyFrac,
  parapet: (w) => w.belowRoomTopFrac,
  shaft: (w) => w.exposedFrac,
}

const PORTION_NOTES: Record<PortionReason, string> = {
  'below-grade': 'of wall area lies below grade',
  'party-wall': 'of wall area touches a neighbouring structure',
  parapet: 'of wall area stands above the highest room behind it',
  shaft: 'of wall area faces a shaft, a chase, a court with aspect ratio of 3 or more, or rooms on both sides',
}

export function isPortionReason(reason: ExclusionReason): reason is PortionReason {
  return reason in KEEP
}

export type AppliedExclusions = {
  removed: Set<number>
  portions: Map<number, Set<PortionReason>>
  unconfirmed: Exclusion[]
}

export function applyExclusions(exclusions: Exclusion[], reasons?: readonly ExclusionReason[]): AppliedExclusions {
  const removed = new Set<number>()
  const portions = new Map<number, Set<PortionReason>>()
  const unconfirmed: Exclusion[] = []
  for (const exclusion of exclusions) {
    if (reasons && !reasons.includes(exclusion.reason)) continue
    if (!exclusion.confirmed) {
      unconfirmed.push(exclusion)
      continue
    }
    const reason = exclusion.reason
    for (const dbId of exclusion.dbIds) {
      if (!isPortionReason(reason)) removed.add(dbId)
      else portions.set(dbId, (portions.get(dbId) ?? new Set()).add(reason))
    }
  }
  return { removed, portions, unconfirmed }
}

export function keptShare(wall: WallProbe, applied: AppliedExclusions): number {
  let keep = 1
  for (const reason of applied.portions.get(wall.element.dbId) ?? []) keep *= KEEP[reason](wall)
  return keep
}

export function touching(exclusions: Exclusion[], dbIds: ReadonlySet<number>): string[] {
  return exclusions.filter((e) => e.dbIds.some((id) => dbIds.has(id))).map((e) => e.id)
}

const fmt = (m2: number) => `${m2.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m²`

/**
 * Exclusions the rules can justify from geometry and names, for a person to confirm.
 * Ids are stable, so proposing again over the same snapshot returns the same set.
 */
export function proposeExclusions(snapshot: Snapshot, classifications: Classification[]): Exclusion[] {
  const env = analyzeEnvelope(snapshot)
  const roles = roleIndex(classifications)
  const proposals: Exclusion[] = []

  const facade = [...env.walls.values()].filter((w) => {
    const role = roles.roleOf(w.element)
    return role !== null && FACADE_WALL_ROLES.has(role) && w.wallClass === 'envelope'
  })
  for (const reason of Object.keys(KEEP) as PortionReason[]) {
    const walls = facade.filter((w) => KEEP[reason](w) < 1 - 1e-9)
    if (walls.length === 0) continue
    const area = walls.reduce((sum, w) => sum + (w.element.area ?? 0) * (1 - KEEP[reason](w)), 0)
    proposals.push({
      id: `rule:${reason}`,
      dbIds: walls.map((w) => w.element.dbId),
      reason,
      source: 'rule',
      confirmed: false,
      note: `${walls.length} façade walls: ${fmt(area)} ${PORTION_NOTES[reason]}`,
    })
  }

  const massing = new Map<string, { dbIds: number[]; area: number }>()
  for (const element of snapshot.elements) {
    if (element.footprint) continue
    const named = /massing/i.test(`${element.family ?? ''} ${element.typeName ?? ''}`)
    if (!named && roles.roleOf(element) !== 'massing') continue
    const group = massing.get(element.typeKey) ?? { dbIds: [], area: 0 }
    group.dbIds.push(element.dbId)
    group.area += element.area ?? 0
    massing.set(element.typeKey, group)
  }
  for (const [typeKey, group] of massing) {
    proposals.push({
      id: `rule:massing:${typeKey}`,
      dbIds: group.dbIds,
      reason: 'massing',
      source: 'rule',
      confirmed: false,
      note: `${typeKey}: ${group.dbIds.length} elements, ${fmt(group.area)} of conceptual massing or context`,
    })
  }
  return proposals
}
