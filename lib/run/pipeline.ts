import { classifySnapshot, toDecisionItem, type DecisionItem } from '@/lib/classify'
import { proposeExclusions } from '@/lib/edge/exclusions'
import { computeRun } from '@/lib/edge/run'
import type { Classification, ElementRole, Exclusion, ExclusionStatus, RunResult, Snapshot } from '@/lib/edge/types'

/** What the person and earlier runs already decided for this project. */
export type Prior = {
  classifications: Classification[]
  exclusions: Exclusion[]
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
/** Below the confirm threshold, so an agent answer always waits for the person. */
const AGENT_CONFIDENCE = 0.5

/**
 * Rule proposals take the person's earlier status by id, so a rejected one comes back rejected rather than as new.
 * Agent and user exclusions from earlier runs carry over with their status; a rule row the rules no longer propose drops.
 */
export function mergeExclusions(proposals: Exclusion[], prior: Exclusion[]): Exclusion[] {
  const statusOf = new Map(prior.map((e) => [e.id, e.status]))
  const proposed = new Set(proposals.map((p) => p.id))
  return [
    ...proposals.map((p) => ({ ...p, status: statusOf.get(p.id) ?? p.status })),
    ...prior.filter((e) => e.source !== 'rule' && !proposed.has(e.id)),
  ]
}

export function withConfirmedType(classifications: Classification[], typeKey: string, role: ElementRole): Classification[] {
  const confirmed: Classification = { typeKey, role, source: 'user', confidence: 1, reason: USER_REASON }
  const rest = classifications.filter((c) => c.typeKey !== typeKey)
  return [...rest, confirmed]
}

/** The agent's answer for a type: it turns pending with this role preselected until the person confirms. */
export function withProposedType(classifications: Classification[], typeKey: string, role: ElementRole, reason: string): Classification[] {
  const proposed: Classification = { typeKey, role, source: 'model', confidence: AGENT_CONFIDENCE, reason: `Agent: ${reason}` }
  return [...classifications.filter((c) => c.typeKey !== typeKey), proposed]
}

/** Adds the exclusion unless one with the same id is already there, so a repeated proposal changes nothing. */
export function withProposedExclusion(exclusions: Exclusion[], exclusion: Exclusion): Exclusion[] {
  return exclusions.some((e) => e.id === exclusion.id) ? exclusions : [...exclusions, exclusion]
}

/** Accepting, rejecting and undoing are one move: the exclusion takes the new status. */
export function withDecision(exclusions: Exclusion[], id: string, status: ExclusionStatus): Exclusion[] {
  return exclusions.map((e) => (e.id === id ? { ...e, status } : e))
}

/**
 * The answer for a type once the person's is dropped: the rules, then an earlier model answer, then the decision model.
 * Empty when none answers, so the type waits for the person with nothing preselected.
 */
export async function answerWithoutUser(
  snapshot: Snapshot,
  classifications: Classification[],
  typeKey: string,
  classify: PipelineIO['classify'],
): Promise<Classification[]> {
  const { merged, leftovers } = classifySnapshot(snapshot, classifications.filter((c) => c.typeKey !== typeKey))
  const settled = merged.find((c) => c.typeKey === typeKey)
  if (settled) return [settled]
  const group = leftovers.find((g) => g.typeKey === typeKey)
  const answers = group ? await classify([toDecisionItem(group)]).catch(() => [] as Classification[]) : []
  return answers.filter((a) => a.typeKey === typeKey)
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
  return run.exclusions.filter((e) => e.status === 'proposed')
}

export type Decisions = { exclusions: Exclusion[]; types: Classification[] }

/** What the person settled and can undo: accepted or rejected exclusions and the types they confirmed. */
export function decisions(run: RunResult): Decisions {
  return {
    exclusions: run.exclusions.filter((e) => e.status !== 'proposed'),
    types: run.classifications.filter((c) => c.source === 'user'),
  }
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
