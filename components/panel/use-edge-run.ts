'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { ElementRole, RunResult, RunState } from '@/lib/edge/types'
import { loadMockRun } from '@/lib/ui/mock-run'
import { messages } from '@/lib/ui/messages'

export type EdgeRunPhase = 'idle' | 'measuring' | 'settled'

export interface EdgeRunStore {
  phase: EdgeRunPhase
  run: RunResult | null
  error: string | null
}

type Action =
  | { type: 'check' }
  | { type: 'measured'; run: RunResult }
  | { type: 'failed'; message: string }
  | { type: 'confirm-type'; typeKey: string; role: ElementRole }
  | { type: 'decide-exclusion'; id: string; accept: boolean }
  | { type: 'north'; angleDeg: number }
  | { type: 'exported' }

function pendingTypeKeys(run: RunResult): string[] {
  return run.classifications.filter((c) => c.source === 'model' && c.confidence < 0.6).map((c) => c.typeKey)
}

/** The run is confirmed once nothing waits on the person. The person's own decisions never undo that. */
function settle(run: RunResult): RunResult {
  if (run.state === 'exported') return run
  const pending = pendingTypeKeys(run).length > 0 || run.exclusions.some((e) => !e.confirmed)
  const state: RunState = pending ? 'provisional' : 'confirmed'
  return {
    ...run,
    state,
    measures: run.measures.map((m) => ({
      ...m,
      pendingTypeKeys: m.pendingTypeKeys.filter((k) => pendingTypeKeys(run).includes(k)),
      state: m.state === 'blocked' ? 'blocked' : state === 'confirmed' ? 'ok' : 'provisional',
    })),
  }
}

function reduce(store: EdgeRunStore, action: Action): EdgeRunStore {
  switch (action.type) {
    case 'check':
      return { ...store, phase: 'measuring', error: null }
    case 'measured':
      return { phase: 'settled', run: settle(action.run), error: null }
    case 'failed':
      return { ...store, phase: store.run ? 'settled' : 'idle', error: action.message }
  }
  if (!store.run) return store
  const run = store.run
  switch (action.type) {
    case 'confirm-type':
      return {
        ...store,
        run: settle({
          ...run,
          classifications: run.classifications.map((c) =>
            c.typeKey === action.typeKey ? { ...c, role: action.role, source: 'user', confidence: 1 } : c,
          ),
        }),
      }
    case 'decide-exclusion':
      return {
        ...store,
        run: settle({
          ...run,
          exclusions: action.accept
            ? run.exclusions.map((e) => (e.id === action.id ? { ...e, confirmed: true } : e))
            : run.exclusions.filter((e) => e.id !== action.id),
        }),
      }
    case 'north':
      return {
        ...store,
        run: { ...run, snapshot: { ...run.snapshot, north: { source: 'user', angleDeg: action.angleDeg } } },
      }
    case 'exported':
      return { ...store, run: { ...run, state: 'exported' } }
  }
}

const INITIAL: EdgeRunStore = { phase: 'idle', run: null, error: null }

export function runStateOf(store: EdgeRunStore): RunState {
  if (store.phase === 'measuring') return 'measuring'
  return store.run?.state ?? 'idle'
}

/** Drives the mock engine today; the integration unit swaps `loadMockRun` for the real one. */
export function useEdgeRun() {
  const [store, dispatch] = useReducer(reduce, INITIAL)
  const inFlight = useRef<AbortController | null>(null)

  useEffect(() => () => inFlight.current?.abort(), [])

  const check = useCallback(() => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    dispatch({ type: 'check' })
    loadMockRun(controller.signal)
      .then((run) => dispatch({ type: 'measured', run }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        dispatch({ type: 'failed', message: messages.errors.checkFailed })
      })
  }, [])

  return {
    store,
    state: runStateOf(store),
    check,
    confirmType: (typeKey: string, role: ElementRole) => dispatch({ type: 'confirm-type', typeKey, role }),
    decideExclusion: (id: string, accept: boolean) => dispatch({ type: 'decide-exclusion', id, accept }),
    setNorth: (angleDeg: number) => dispatch({ type: 'north', angleDeg }),
    markExported: () => dispatch({ type: 'exported' }),
  }
}
