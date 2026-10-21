import type { Classification, Element, ElementRole } from './types'

/** Below this, a model answer waits for a person. Matches the gateway's fallback threshold. */
export const CONFIRM_BELOW = 0.6

/** Wall roles that can carry façade area. A curtain wall host keeps its curtain role from the classifier. */
export const FACADE_WALL_ROLES: ReadonlySet<ElementRole> = new Set(['exterior-wall', 'curtain-glazed', 'curtain-solid'])

export type RoleIndex = {
  roleOf(element: Element): ElementRole | null
  /** True when the type has no settled answer: unclassified, a model guess, or low confidence. */
  isPending(typeKey: string): boolean
}

export function roleIndex(classifications: Classification[]): RoleIndex {
  const byType = new Map(classifications.map((c) => [c.typeKey, c]))
  return {
    roleOf: (element) => byType.get(element.typeKey)?.role ?? null,
    isPending: (typeKey) => {
      const c = byType.get(typeKey)
      return !c || c.source === 'model' || c.confidence < CONFIRM_BELOW
    },
  }
}

export function pendingOf(typeKeys: Iterable<string>, roles: RoleIndex): string[] {
  return [...new Set(typeKeys)].filter((k) => roles.isPending(k)).sort()
}
