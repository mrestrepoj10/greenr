import { applyExclusions, touching, type AppliedExclusions } from '../exclusions'
import { pendingOf, roleIndex, type RoleIndex } from '../roles'
import type { Classification, Element, ElementRole, Exclusion, Gap, MeasureBlocker, MeasureCodeOf, MeasureResult, Snapshot } from '../types'

export type Scope = { snapshot: Snapshot; roles: RoleIndex; applied: AppliedExclusions }

export const scopeOf = (snapshot: Snapshot, classifications: Classification[], exclusions: Exclusion[]): Scope => ({
  snapshot,
  roles: roleIndex(classifications),
  applied: applyExclusions(exclusions),
})

export type Selection = { used: Element[]; involved: Element[] }
type Pending = Pick<MeasureResult, 'pendingTypeKeys' | 'pendingExclusionIds'>

/** Elements classified as one of `roles` and not excluded. `involved` adds the unclassified elements of `category`, which keep the measure provisional. */
export function select(scope: Scope, roles: readonly ElementRole[], category: RegExp): Selection {
  const used: Element[] = []
  const involved: Element[] = []
  for (const e of scope.snapshot.elements) {
    const role = scope.roles.roleOf(e)
    if (role !== null && roles.includes(role)) {
      involved.push(e)
      if (!scope.applied.removed.has(e.dbId)) used.push(e)
    } else if (role === null && category.test(e.category)) involved.push(e)
  }
  return { used, involved }
}

/** EEM01's rule: a pending type, or an unconfirmed exclusion over an involved element, keeps the result provisional. */
export function pendingFor(scope: Scope, involved: Iterable<Element>): Required<Pending> {
  const list = [...involved]
  return {
    pendingTypeKeys: pendingOf(
      list.map((e) => e.typeKey),
      scope.roles,
    ),
    pendingExclusionIds: touching(scope.applied.unconfirmed, new Set(list.map((e) => e.dbId))),
  }
}

export function mergePending(parts: Pending[]): Required<Pending> {
  return {
    pendingTypeKeys: [...new Set(parts.flatMap((p) => p.pendingTypeKeys))].sort(),
    pendingExclusionIds: [...new Set(parts.flatMap((p) => p.pendingExclusionIds ?? []))].sort(),
  }
}

/** One type that lacks a parameter the measure reads. The measure's `missing-parameter` blocker says whether it blocks. */
export function typeGap(
  code: MeasureCodeOf<'CASA'>,
  missing: string,
  message: string,
  typeKey: string,
  dbIds: number[],
  severity: Gap['severity'] = 'needs-data-sheet',
): Gap {
  return { id: `${code}:${typeKey}`, measure: code, typeKey, dbIds, missing, severity, message }
}

export type RoomPlacement = { total: number; placed: number; unplaced: boolean }

/** TORRE A placed 6 of its 73 rooms; the envelope probe then found 17 walls of a 16-storey tower. Below half placed, the probe is not trusted. */
export const MIN_PLACED_ROOM_SHARE = 0.5

export function roomPlacement(snapshot: Snapshot): RoomPlacement {
  const rooms = snapshot.elements.filter((e) => /Rooms/.test(e.category))
  const placed = rooms.filter((r) => r.footprint !== undefined && (r.area ?? 0) > 0).length
  return { total: rooms.length, placed, unplaced: placed === 0 || placed < rooms.length * MIN_PLACED_ROOM_SHARE }
}

export const unplacedBlocker = (p: RoomPlacement): MeasureBlocker => ({ kind: 'unplaced-rooms', count: p.total - p.placed, total: p.total })
