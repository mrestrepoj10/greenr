import type { Classification, Snapshot } from '@/lib/edge/types'
import { classifyByRule } from './rules'
import { groupByType, indexByDbId, type TypeGroup } from './types-index'
import type { DecisionItem } from './decide'

export type { TypeGroup } from './types-index'
export type { DecisionItem, DecideOptions } from './decide'
export { classifyByRule, RULES } from './rules'
export { groupByType, indexByDbId, paramValue } from './types-index'
export { decideRoles, MAX_ITEMS_PER_REQUEST } from './decide'

export type SnapshotClassification = {
  /** Rule answers for every type the table settles, including types a user prior overrides. */
  byRule: Classification[]
  /** Types no rule and no prior settled. These go to the decision model, then to the person. */
  leftovers: TypeGroup[]
  /** One row per type that is settled: user priors first, then model priors, then rules. */
  merged: Classification[]
}

/** User and model answers from earlier runs. A user answer always wins; a model answer only fills a type no rule settles. */
export function classifySnapshot(snapshot: Snapshot, prior: Classification[] = []): SnapshotClassification {
  const byDbId = indexByDbId(snapshot.elements)
  const userPrior = new Map(prior.filter((c) => c.source === 'user').map((c) => [c.typeKey, c]))
  const modelPrior = new Map(prior.filter((c) => c.source === 'model' && c.confidence > 0).map((c) => [c.typeKey, c]))
  const byRule: Classification[] = []
  const leftovers: TypeGroup[] = []
  const merged: Classification[] = []
  for (const group of groupByType(snapshot.elements).values()) {
    const elements = group.dbIds.map((dbId) => byDbId.get(dbId)!)
    const ruled = classifyByRule(elements, byDbId)
    if (ruled) byRule.push(ruled)
    const settled = userPrior.get(group.typeKey) ?? ruled ?? modelPrior.get(group.typeKey)
    if (settled) merged.push(settled)
    else leftovers.push(group)
  }
  return { byRule, leftovers, merged }
}

export function toDecisionItem(group: TypeGroup): DecisionItem {
  return {
    typeKey: group.typeKey,
    category: group.category,
    family: group.sample.family ?? '',
    typeName: group.sample.typeName ?? '',
    params: group.sample.params,
  }
}
