'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { groupByType } from '@/lib/classify'
import { computeRun } from '@/lib/edge/run'
import type { ElementRole, RunResult, RunState, Snapshot } from '@/lib/edge/types'
import {
  useClassifications,
  useConfirmType,
  useDecideExclusion,
  useExclusions,
  useLatestRun,
  useSaveRun,
  useSetNorth,
  type ProjectId,
} from '@/lib/persist/hooks'
import { classifyRemote } from '@/lib/run/classify-remote'
import { runPipeline, withConfirmedType, withDecision, type PipelinePhase } from '@/lib/run/pipeline'
import { messages } from '@/lib/ui/messages'
import { readSnapshot } from '@/lib/viewer/snapshot'
import type { APSViewer3D } from '@/lib/viewer-types'

export type EdgeRunPhase = { kind: 'idle' } | PipelinePhase | { kind: 'settled' }

export interface EdgeRunStore {
  phase: EdgeRunPhase
  /** The run measured in this page session. Until the first one, the page shows the stored run. */
  live: RunResult | null
  error: string | null
}

type Action =
  | { type: 'phase'; phase: PipelinePhase }
  | { type: 'measured'; run: RunResult }
  | { type: 'failed'; message: string }

function reduce(store: EdgeRunStore, action: Action): EdgeRunStore {
  switch (action.type) {
    case 'phase':
      return { ...store, phase: action.phase, error: null }
    case 'measured':
      return { phase: { kind: 'settled' }, live: action.run, error: null }
    case 'failed':
      return { ...store, phase: { kind: store.live ? 'settled' : 'idle' }, error: action.message }
  }
}

const INITIAL: EdgeRunStore = { phase: { kind: 'idle' }, live: null, error: null }

const BUSY_KINDS = new Set<EdgeRunPhase['kind']>(['snapshot', 'classifying', 'measuring'])

export function runStateOf(phase: EdgeRunPhase, run: RunResult | null): RunState {
  if (BUSY_KINDS.has(phase.kind)) return phase.kind as RunState
  return run?.state ?? 'idle'
}

export function phaseMessage(phase: EdgeRunPhase): string | undefined {
  switch (phase.kind) {
    case 'snapshot':
      return messages.phase.snapshot
    case 'classifying':
      return messages.phase.classifying(phase.types)
    case 'measuring':
      return messages.phase.measuring
  }
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

/** Lets the phase line paint before the next synchronous step holds the main thread. */
const nextPaint = () =>
  new Promise<void>((resolve) => {
    const done = () => resolve()
    requestAnimationFrame(() => setTimeout(done, 0))
    setTimeout(done, 50)
  })

export interface UseEdgeRunOptions {
  projectId: ProjectId | null
  getViewer: () => APSViewer3D | null
  /** True north the person set for this project, in degrees. Undefined uses the model's own. */
  userNorth?: number
}

/**
 * The run pipeline over the live viewer: snapshot, classification, proposals, measures. The snapshot stays in memory;
 * every decision recomputes from it and persists through Convex.
 */
export function useEdgeRun({ projectId, getViewer, userNorth }: UseEdgeRunOptions) {
  const [store, dispatch] = useReducer(reduce, INITIAL)
  const stored = useLatestRun(projectId)
  const priorClassifications = useClassifications(projectId)
  const priorExclusions = useExclusions(projectId)
  const saveRun = useSaveRun()
  const confirmTypeRow = useConfirmType()
  const decideExclusionRow = useDecideExclusion()
  const setNorthRow = useSetNorth()

  const run = store.live ?? stored?.run ?? null
  const runDocId = stored && run && stored.run.runId === run.runId ? stored.runDocId : null

  const latest = useRef<RunResult | null>(run)
  const snapshotRef = useRef<Snapshot | null>(null)
  const snapshotRead = useRef<Promise<Snapshot> | null>(null)
  const [typeIndex, setTypeIndex] = useState(() => new Map<string, number[]>())
  const inFlight = useRef<AbortController | null>(null)
  const context = useRef({ projectId, userNorth, priorClassifications, priorExclusions })

  useEffect(() => {
    latest.current = run
  }, [run])
  useEffect(() => {
    context.current = { projectId, userNorth, priorClassifications, priorExclusions }
  }, [projectId, userNorth, priorClassifications, priorExclusions])
  useEffect(() => () => inFlight.current?.abort(), [])

  const adopt = useCallback((snapshot: Snapshot) => {
    snapshotRef.current = snapshot
    setTypeIndex(new Map([...groupByType(snapshot.elements).values()].map((g) => [g.typeKey, g.dbIds])))
    return snapshot
  }, [])

  const requireViewer = useCallback(() => {
    const viewer = getViewer()
    if (!viewer?.model) throw new Error(messages.errors.viewerNotReady)
    return viewer
  }, [getViewer])

  const ensureSnapshot = useCallback(async () => {
    if (snapshotRef.current) return snapshotRef.current
    snapshotRead.current ??= readSnapshot(requireViewer(), { northAngleDeg: context.current.userNorth }).then(adopt)
    try {
      return await snapshotRead.current
    } finally {
      snapshotRead.current = null
    }
  }, [adopt, requireViewer])

  const commit = useCallback(
    (next: RunResult) => {
      latest.current = next
      dispatch({ type: 'measured', run: next })
      const id = context.current.projectId
      if (id) saveRun(id, next).catch(() => dispatch({ type: 'failed', message: messages.errors.saveFailed }))
    },
    [saveRun],
  )

  const check = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const { userNorth: north, priorClassifications: classifications, priorExclusions: exclusions } = context.current
    try {
      const viewer = requireViewer()
      const live = await runPipeline(
        {
          readSnapshot: () => readSnapshot(viewer, { northAngleDeg: north }),
          classify: (items) => classifyRemote(items, controller.signal),
          onPhase: (phase) => {
            dispatch({ type: 'phase', phase })
            return nextPaint()
          },
          signal: controller.signal,
        },
        { classifications: classifications ?? [], exclusions: exclusions ?? [] },
      )
      adopt(live.snapshot)
      commit(live.run)
      if (live.unclassified > 0) dispatch({ type: 'failed', message: messages.errors.unclassified(live.unclassified) })
    } catch (error) {
      if (isAbort(error)) return
      dispatch({ type: 'failed', message: error instanceof Error && error.message ? error.message : messages.errors.checkFailed })
    }
  }, [adopt, commit, requireViewer])

  const recompute = useCallback(
    async (change: (base: RunResult) => Pick<RunResult, 'classifications' | 'exclusions'>) => {
      const base = latest.current
      if (!base) return null
      try {
        const snapshot = await ensureSnapshot()
        const now = latest.current ?? base
        const { classifications, exclusions } = change(now)
        const next = computeRun(snapshot, classifications, exclusions, now)
        commit(next)
        return next
      } catch (error) {
        dispatch({ type: 'failed', message: error instanceof Error ? error.message : messages.errors.checkFailed })
        return null
      }
    },
    [commit, ensureSnapshot],
  )

  const confirmType = useCallback(
    (typeKey: string, role: ElementRole) => {
      const id = context.current.projectId
      if (id) confirmTypeRow(id, typeKey, role).catch(() => dispatch({ type: 'failed', message: messages.errors.saveFailed }))
      return recompute((r) => ({ classifications: withConfirmedType(r.classifications, typeKey, role), exclusions: r.exclusions }))
    },
    [confirmTypeRow, recompute],
  )

  const decideExclusion = useCallback(
    (exclusionId: string, accept: boolean) => {
      const id = context.current.projectId
      if (id) decideExclusionRow(id, exclusionId, accept).catch(() => dispatch({ type: 'failed', message: messages.errors.saveFailed }))
      return recompute((r) => ({ classifications: r.classifications, exclusions: withDecision(r.exclusions, exclusionId, accept) }))
    },
    [decideExclusionRow, recompute],
  )

  const setNorth = useCallback(
    async (angleDeg: number) => {
      const id = context.current.projectId
      context.current = { ...context.current, userNorth: angleDeg }
      if (id) setNorthRow(id, angleDeg, 'user').catch(() => dispatch({ type: 'failed', message: messages.errors.saveFailed }))
      const base = latest.current
      if (!base) return
      try {
        dispatch({ type: 'phase', phase: { kind: 'snapshot' } })
        await nextPaint()
        const snapshot = adopt(await readSnapshot(requireViewer(), { northAngleDeg: angleDeg }))
        const now = latest.current ?? base
        commit(computeRun(snapshot, now.classifications, now.exclusions, now))
      } catch (error) {
        dispatch({ type: 'failed', message: error instanceof Error ? error.message : messages.errors.checkFailed })
      }
    },
    [adopt, commit, requireViewer, setNorthRow],
  )

  const markExported = useCallback(() => {
    const base = latest.current
    if (base) commit({ ...base, state: 'exported' })
  }, [commit])

  const elementsOf = useCallback((typeKey: string) => typeIndex.get(typeKey) ?? [], [typeIndex])

  /** Massing and context elements: anything a massing exclusion names, and every element of a type classified massing. */
  const contextIds = useMemo(() => {
    if (!run) return []
    const ids = new Set(run.exclusions.filter((e) => e.reason === 'massing').flatMap((e) => e.dbIds))
    for (const c of run.classifications) if (c.role === 'massing') for (const dbId of elementsOf(c.typeKey)) ids.add(dbId)
    return [...ids]
  }, [run, elementsOf])

  return {
    run,
    runDocId,
    origin: store.live ? ('live' as const) : run ? ('stored' as const) : null,
    phase: store.phase,
    state: runStateOf(store.phase, run),
    error: store.error,
    check,
    confirmType,
    decideExclusion,
    setNorth,
    markExported,
    elementsOf,
    contextIds,
    ensureSnapshot,
    latestRun: () => latest.current,
  }
}

export type EdgeRun = ReturnType<typeof useEdgeRun>
