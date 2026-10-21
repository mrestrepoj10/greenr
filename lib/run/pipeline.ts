import { classifySnapshot, toDecisionItem, type DecisionItem } from '@/lib/classify'
import { proposeExclusions } from '@/lib/edge/exclusions'
import { computeRun } from '@/lib/edge/run'
import type { Classification, ElementRole, Exclusion, RunResult, Snapshot } from '@/lib/edge/types'

export type ExclusionStatus = 'proposed' | 'accepted' | 'rejected'
export type PriorExclusion = Exclusion & { status: ExclusionStatus }

/** What the person and earlier runs already decided for this project. */
export type Prior = {
  classifications: Classification[]
  exclusions: PriorExclusion[]
}

export type PipelinePhase = { kind: 'snapshot' } | { kind: 'classifying'; types: number } | { kind: 'measuring' }

export type PipelineIO = {
  readSnapshot: () => Promise<Snapshot>
  classify: (items: DecisionItem[]) => Promise<Classification[]>
  /** Resolves once the phase is on screen, so the long synchronous steps never hide it. */
  onPhase: (phase: PipelinePhase) => Promise<void>
  signal?: AbortSignal
}

export type LiveRun = {
  snapshot: Snapshot
  run: RunResult
  /** Leftover types the decision model could not answer for. They stay pending for the person. */
  unclassified: number
}

const USER_REASON = 'Confirmed by the user'

/**
 * Rule proposals take the person's earlier decision by id: accepted ones arrive confirmed, rejected ones stay out.
 * Agent and user exclusions from earlier runs carry over unless rejected.
 */
export function mergeExclusions(proposals: Exclusion[], prior: PriorExclusion[]): Exclusion[] {
  const byId = new Map(prior.map((e) => [e.id, e]))
  const merged: Exclusion[] = []
  for (const proposal of proposals) {
    const status = byId.get(proposal.id)?.status
    if (status === 'rejected') continue
    merged.push({ ...proposal, confirmed: status === 'accepted' })
  }
  const proposed = new Set(proposals.map((p) => p.id))
  for (const { status, ...exclusion } of prior) {
    if (exclusion.source === 'rule' || proposed.has(exclusion.id) || status === 'rejected') continue
    merged.push({ ...exclusion, confirmed: status === 'accepted' })
  }
  return merged
}

export function withConfirmedType(classifications: Classification[], typeKey: string, role: ElementRole): Classification[] {
  const confirmed: Classification = { typeKey, role, source: 'user', confidence: 1, reason: USER_REASON }
  const rest = classifications.filter((c) => c.typeKey !== typeKey)
  return [...rest, confirmed]
}

export function withDecision(exclusions: Exclusion[], id: string, accept: boolean): Exclusion[] {
  return accept ? exclusions.map((e) => (e.id === id ? { ...e, confirmed: true } : e)) : exclusions.filter((e) => e.id !== id)
}

/** Every type a measure waits on, with its current answer when it has one. */
export function pendingTypes(run: RunResult): Classification[] {
  const keys = [...new Set(run.measures.flatMap((m) => m.pendingTypeKeys))].sort()
  const byKey = new Map(run.classifications.map((c) => [c.typeKey, c]))
  return keys.map(
    (typeKey) =>
      byKey.get(typeKey) ?? { typeKey, role: 'other', source: 'model', confidence: 0, reason: 'No rule or model answer yet' },
  )
}

export function openExclusions(run: RunResult): Exclusion[] {
  return run.exclusions.filter((e) => !e.confirmed)
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('The check was cancelled.', 'AbortError')
}

/** Snapshot, then rules and earlier answers, then the decision model for leftovers, then the proposals and every measure. */
export async function runPipeline(io: PipelineIO, prior: Prior): Promise<LiveRun> {
  await io.onPhase({ kind: 'snapshot' })
  const snapshot = await io.readSnapshot()
  throwIfAborted(io.signal)

  const { merged, leftovers } = classifySnapshot(snapshot, prior.classifications)
  let classifications = merged
  let unclassified = 0
  if (leftovers.length > 0) {
    await io.onPhase({ kind: 'classifying', types: leftovers.length })
    const answers = await io.classify(leftovers.map(toDecisionItem)).catch(() => [] as Classification[])
    throwIfAborted(io.signal)
    unclassified = leftovers.length - answers.filter((a) => a.confidence > 0).length
    classifications = [...merged, ...answers]
  }

  await io.onPhase({ kind: 'measuring' })
  throwIfAborted(io.signal)
  const exclusions = mergeExclusions(proposeExclusions(snapshot, classifications), prior.exclusions)
  return { snapshot, run: computeRun(snapshot, classifications, exclusions), unclassified }
}
