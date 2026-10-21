import type { Agent, AgentOptions, Turn, TurnEvent } from 'libfx/browser'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  type AgentAction,
  type AgentToolResult,
  describeAgentUnavailableReason,
  type ElementSet,
} from '@/lib/agent-types'
import {
  type AgentProblem,
  createGatewayFetch,
  problemForError,
  problemForRefusal,
  RefusalTextFilter,
} from '@/lib/fx-agent-gateway'
import {
  addUsage,
  createIndexedDbStorage,
  EMPTY_USAGE,
  type FxAgentStorage,
} from '@/lib/fx-agent-storage'
import {
  appendAction,
  appendDelta,
  errorText,
  finishAction,
  humanizeToolName,
  inputKey,
  mapActions,
  modelLabelFor,
  toHostResult,
  toHostTool,
} from '@/lib/fx-agent-transcript'
import type {
  FxAgentViewer,
  FxSendOptions,
  FxViewerAgent,
  FxViewerAgentOptions,
  FxViewerAgentSnapshot,
  FxViewerAgentState,
} from '@/lib/fx-agent-types'

export type { FxAgentStorage, FxAgentUsage } from '@/lib/fx-agent-storage'
export { createIndexedDbStorage } from '@/lib/fx-agent-storage'
export type {
  FxAgentViewer,
  FxRuntime,
  FxSendOptions,
  FxViewerAgent,
  FxViewerAgentActions,
  FxViewerAgentOptions,
  FxViewerAgentSnapshot,
  FxViewerAgentState,
} from '@/lib/fx-agent-types'

export const DEFAULT_FX_MODEL = 'anthropic/claude-haiku-5.5'
export const DEFAULT_GATEWAY_BASE = '/api/agent/gateway'

const RATE_LIMIT_PAUSE_MS = 60_000
const VIEWER_POLL_MS = 500

interface Execution {
  tool: string
  key: string
  actionId: string | null
  result?: AgentToolResult
  error?: string
}

function sameSnapshot(a: FxViewerAgentSnapshot, b: FxViewerAgentSnapshot): boolean {
  return (Object.keys(a) as (keyof FxViewerAgentSnapshot)[]).every((key) => a[key] === b[key])
}

/** The libfx agent behind the agent surfaces, as an external store. Runs in the browser only. */
export function createFxViewerAgent(initialOptions: FxViewerAgentOptions): FxViewerAgent {
  let options = initialOptions
  const { tools } = initialOptions
  const now = () => (options.now ?? Date.now)()
  const storage = (): FxAgentStorage | null => {
    if (options.storageKey === null) return null
    if (!options.storage) options = { ...options, storage: createIndexedDbStorage() }
    return options.storage ?? null
  }
  const storageKey = () => options.storageKey ?? 'cantera-fx-agent'
  const modelId = () => options.model ?? DEFAULT_FX_MODEL

  const listeners = new Set<() => void>()
  let idBase = ''
  let idSequence = 0
  const createId = (prefix: string) => {
    idBase ||= now().toString(36)
    idSequence += 1
    return `${prefix}-${idBase}-${idSequence}`
  }

  const initial: FxViewerAgentSnapshot = {
    messages: [],
    turnStatus: 'idle',
    runtimeStatus: 'starting',
    notice: null,
    reason: null,
    modelLabel: options.modelLabel ?? modelLabelFor(modelId()),
    sets: tools.sets.list(),
    legend: tools.colors.legend(),
    selection: null,
    usage: EMPTY_USAGE,
  }
  let snapshot = initial

  let started = false
  let lifetime = 0
  let conversation = 0
  let jspi = true
  let hasModel = false
  let problem: AgentProblem | null = null
  let agent: Agent | null = null
  let creating: Promise<void> | null = null
  let checkpoint: Uint8Array | null = null
  let turn: Turn | null = null
  let executions: Execution[] = []
  const actionIds = new Map<string, string>()
  let unboundActions: { id: string; tool: string; key: string }[] = []
  let undoneLabels: string[] = []
  let selectionSequence = 0
  let persistQueue: Promise<void> = Promise.resolve()
  let viewer: FxAgentViewer | null = null
  let detachViewer: (() => void) | null = null
  let cleanups: (() => void)[] = []
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pauseTimer: ReturnType<typeof setTimeout> | null = null
  const textFilter = new RefusalTextFilter()

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const commit = (patch: Partial<FxViewerAgentSnapshot>) => {
    const base = { ...snapshot, ...patch }
    let derived: Pick<FxViewerAgentSnapshot, 'runtimeStatus' | 'reason' | 'notice'>
    if (!jspi) {
      derived = {
        runtimeStatus: 'unavailable',
        reason: 'unsupported-browser',
        notice: describeAgentUnavailableReason('unsupported-browser'),
      }
    } else if (problem) {
      derived = { runtimeStatus: problem.status, reason: problem.reason, notice: problem.notice }
    } else if (started && !hasModel) {
      derived = {
        runtimeStatus: 'unavailable',
        reason: 'no-model',
        notice: describeAgentUnavailableReason('no-model'),
      }
    } else {
      derived = { runtimeStatus: agent ? 'ready' : 'starting', reason: null, notice: null }
    }
    const previous = snapshot.notice
    const notice =
      derived.notice &&
      previous &&
      derived.notice.title === previous.title &&
      derived.notice.description === previous.description &&
      derived.notice.tone === previous.tone
        ? previous
        : derived.notice
    const next = { ...base, ...derived, notice }
    if (sameSnapshot(next, snapshot)) return
    snapshot = next
    emit()
  }

  const setProblem = (next: AgentProblem | null) => {
    problem = next
    if (pauseTimer !== null) clearTimeout(pauseTimer)
    pauseTimer = null
    if (next?.reason === 'rate-limited') {
      pauseTimer = setTimeout(() => {
        pauseTimer = null
        if (problem === next) setProblem(null)
      }, RATE_LIMIT_PAUSE_MS)
    }
    commit({})
  }

  const syncUndoable = () => {
    const messages = mapActions(snapshot.messages, (action) => {
      if (!action.undoId) return action
      const undoable = tools.undo.has(action.undoId)
      return undoable === action.undoable ? action : { ...action, undoable }
    })
    commit({ messages })
  }

  const gatewayFetch = createGatewayFetch({
    get base() {
      return options.gatewayBase ?? DEFAULT_GATEWAY_BASE
    },
    get fetch() {
      return options.fetch
    },
    onRefusal(refusal) {
      textFilter.arm()
      setProblem(problemForRefusal(refusal))
    },
  })

  const hostTools = tools.tools.map((tool) =>
    toHostTool(tool, async (input, context) => {
      const execution: Execution = { tool: tool.name, key: inputKey(input), actionId: null }
      const waiting = unboundActions.filter((item) => item.tool === tool.name)
      const action = waiting.find((item) => item.key === execution.key) ?? waiting[0]
      if (action) {
        execution.actionId = action.id
        unboundActions = unboundActions.filter((item) => item !== action)
      }
      executions.push(execution)
      try {
        execution.result = await tool.execute(input, { signal: context.signal })
        return toHostResult(execution.result)
      } catch (error) {
        execution.error = errorText(error)
        throw error
      } finally {
        if (execution.actionId) settleLate(execution)
      }
    }),
  )

  const settleLate = (execution: Execution) => {
    const undoId = execution.result?.undoId
    if (!undoId) return
    commit({
      messages: mapActions(snapshot.messages, (action) =>
        action.id === execution.actionId && action.status === 'cancelled' && !action.undoId
          ? { ...action, undoId, undoable: tools.undo.has(undoId) }
          : action,
      ),
    })
  }

  const bindExecution = (actionId: string, tool: string, key: string) => {
    const open = executions.filter((item) => item.actionId === null && item.tool === tool)
    const match = open.find((item) => item.key === key) ?? open[0]
    if (match) match.actionId = actionId
    else unboundActions.push({ id: actionId, tool, key })
  }

  const instructions = () =>
    [tools.instructions, options.instructions].filter((part) => part?.trim()).join('\n\n')

  const ensureAgent = (life: number) => {
    if (agent || creating || !hasModel || !jspi) return
    const loadRuntime = options.loadRuntime ?? (() => import('libfx/browser'))
    const attempt = async () => {
      const runtime = await loadRuntime()
      const base: AgentOptions = {
        apiKey: 'proxy',
        model: options.effort ? { id: modelId(), effort: options.effort } : modelId(),
        instructions: instructions(),
        tools: hostTools,
        fetch: gatewayFetch,
      }
      if (!checkpoint) return runtime.createFxAgent(base)
      try {
        return await runtime.createFxAgent({ ...base, checkpoint })
      } catch {
        checkpoint = null
        await persist(null)
        tools.sets.clear()
        commit({ messages: [], usage: EMPTY_USAGE })
        return runtime.createFxAgent(base)
      }
    }
    creating = attempt()
      .then(
        (created) => {
          if (life !== lifetime) return void created.close()
          agent = created
          if (problem?.reason === 'runtime-error') problem = null
          commit({})
        },
        (error) => {
          if (life === lifetime) setProblem(problemForError(error))
        },
      )
      .finally(() => {
        creating = null
      })
  }

  const describeSelection = (target: FxAgentViewer) => {
    selectionSequence += 1
    const sequence = selectionSequence
    const ids = target.getSelection()
    if (ids.length === 0) return commit({ selection: null })
    tools.describeSelection(ids).then(
      (selection) => {
        if (sequence === selectionSequence) commit({ selection })
      },
      () => undefined,
    )
  }

  const stopPolling = () => {
    if (pollTimer !== null) clearInterval(pollTimer)
    pollTimer = null
  }

  const refreshViewer = () => {
    if (!started) return
    const next = options.getViewer()
    if (next !== viewer) {
      detachViewer?.()
      detachViewer = null
      viewer = next
      if (next) {
        const viewing = globalThis.window?.Autodesk?.Viewing
        const onSelection = () => describeSelection(next)
        const onModel = () => refreshViewer()
        const events: [string, () => void][] = [
          [viewing?.SELECTION_CHANGED_EVENT ?? 'selection', onSelection],
          [viewing?.GEOMETRY_LOADED_EVENT ?? 'geometryLoaded', onModel],
          [viewing?.MODEL_UNLOADED_EVENT ?? 'modelUnloaded', onModel],
          [viewing?.MODEL_REMOVED_EVENT ?? 'modelRemoved', onModel],
          [viewing?.VIEWER_UNINITIALIZED ?? 'viewerUninitialized', () => setTimeout(onModel)],
        ]
        for (const [type, handler] of events) next.addEventListener(type, handler)
        detachViewer = () => {
          for (const [type, handler] of events) next.removeEventListener(type, handler)
        }
        describeSelection(next)
      } else {
        commit({ selection: null })
      }
    }
    if (viewer) stopPolling()
    else if (pollTimer === null && !options.subscribeViewer) {
      pollTimer = setInterval(refreshViewer, VIEWER_POLL_MS)
    }
    hasModel = Boolean(viewer?.model?.isLoadDone())
    commit({})
    ensureAgent(lifetime)
  }

  const persist = (record: { checkpoint: Uint8Array; conversation: number } | null) => {
    const store = storage()
    if (!store) return Promise.resolve()
    const key = storageKey()
    persistQueue = persistQueue
      .then(async () => {
        if (!record) return store.remove(key)
        if (record.conversation !== conversation) return
        await store.save(key, {
          checkpoint: record.checkpoint,
          transcript: {
            messages: [...snapshot.messages],
            sets: [...tools.sets.list()],
            usage: snapshot.usage,
          },
          savedAt: now(),
        })
      })
      .catch(() => store.remove(key).catch(() => undefined))
    return persistQueue
  }

  const boot = async (life: number) => {
    const loadRuntime = options.loadRuntime ?? (() => import('libfx/browser'))
    try {
      const runtime = await loadRuntime()
      if (life !== lifetime) return
      jspi = runtime.supportsJspi()
      if (!jspi) return commit({})
      const store = storage()
      const record = store ? await store.load(storageKey()).catch(() => null) : null
      if (life !== lifetime) return
      if (record) {
        checkpoint = record.checkpoint
        tools.sets.restore(record.transcript.sets)
        commit({ messages: record.transcript.messages, usage: record.transcript.usage })
      }
      if (options.subscribeViewer) cleanups.push(options.subscribeViewer(refreshViewer))
      refreshViewer()
    } catch (error) {
      if (life === lifetime) setProblem(problemForError(error))
    }
  }

  const handleEvent = (event: TurnEvent) => {
    const at = now()
    if (event.type === 'text_delta') {
      const text = textFilter.push(event.delta)
      if (text) {
        commit({ messages: appendDelta(snapshot.messages, 'text', text, () => createId('m'), at) })
      }
      return
    }
    const held = textFilter.flush()
    let messages = held
      ? appendDelta(snapshot.messages, 'text', held, () => createId('m'), at)
      : snapshot.messages
    switch (event.type) {
      case 'reasoning_delta':
        messages = appendDelta(messages, 'reasoning', event.delta, () => createId('m'), at)
        break
      case 'user_message':
        messages = [
          ...messages,
          {
            id: createId('m'),
            role: 'user',
            createdAt: at,
            parts: [{ type: 'text', text: event.text }],
          },
        ]
        break
      case 'tool_start': {
        const id = createId('a')
        actionIds.set(event.id, id)
        const input = event.input ?? event.inputPreview
        bindExecution(id, event.name, inputKey(input))
        const action: AgentAction = {
          id,
          tool: event.name,
          label: humanizeToolName(event.name),
          status: 'running',
          startedAt: at,
          input,
          undoable: false,
        }
        messages = appendAction(messages, action, () => createId('m'), at)
        break
      }
      case 'tool_end': {
        const id = actionIds.get(event.id)
        const execution = executions.find((item) => item.actionId === id)
        messages = mapActions(messages, (action) =>
          action.id === id
            ? finishAction(
                action,
                {
                  result: execution?.result,
                  error: execution?.error,
                  content: event.content,
                  isError: event.isError,
                },
                at,
                (undoId) => tools.undo.has(undoId),
              )
            : action,
        )
        break
      }
    }
    commit({ messages })
  }

  const promptFor = (text: string, includeSelection: boolean) => {
    const lines = [text]
    if (undoneLabels.length > 0) {
      lines.push(`Since your last reply the user undid: ${undoneLabels.join('; ')}.`)
    }
    const { selection } = snapshot
    if (includeSelection && selection && selection.dbIds.length > 0) {
      const count = selection.dbIds.length
      const what = `${count} ${count === 1 ? 'element' : 'elements'}`
      const detail = selection.summary ? ` (${selection.summary})` : ''
      lines.push(`Selected right now: ${what}${detail}, setId "selection".`)
    }
    return lines.join('\n\n')
  }

  const send = async (text: string, sendOptions: FxSendOptions = {}) => {
    const trimmed = text.trim()
    if (!trimmed || turn || !agent || snapshot.runtimeStatus !== 'ready') return
    const current = agent
    const ownConversation = conversation
    const prompt = promptFor(trimmed, sendOptions.includeSelection ?? false)
    undoneLabels = []
    executions = []
    unboundActions = []
    actionIds.clear()
    textFilter.reset()
    const at = now()
    let active: Turn
    try {
      active = current.prompt(prompt)
    } catch (error) {
      setProblem(problemForError(error))
      return
    }
    turn = active
    commit({
      turnStatus: 'running',
      messages: [
        ...snapshot.messages,
        {
          id: createId('m'),
          role: 'user',
          createdAt: at,
          parts: [{ type: 'text', text: trimmed }],
        },
      ],
    })
    const isCurrent = () => ownConversation === conversation && turn === active
    try {
      for await (const event of active) {
        if (isCurrent()) handleEvent(event)
      }
      const result = await active.result
      if (!isCurrent()) return
      const held = textFilter.flush()
      const messages = held
        ? appendDelta(snapshot.messages, 'text', held, () => createId('m'), now())
        : snapshot.messages
      const ended = now()
      turn = null
      commit({
        turnStatus: 'idle',
        usage: addUsage(snapshot.usage, result.usage),
        messages: mapActions(messages, (action) =>
          action.status === 'running' ? { ...action, status: 'cancelled', endedAt: ended } : action,
        ),
      })
      const unanswered = snapshot.messages.at(-1)?.role === 'user'
      if (result.stopReason === 'refused' && unanswered) return
      if (agent === current) {
        const bytes = await current.checkpoint().catch(() => null)
        if (bytes && ownConversation === conversation) {
          checkpoint = bytes
          await persist({ checkpoint: bytes, conversation: ownConversation })
        }
      }
    } catch (error) {
      if (!isCurrent()) return
      turn = null
      const ended = now()
      commit({
        turnStatus: 'idle',
        messages: mapActions(snapshot.messages, (action) =>
          action.status === 'running'
            ? { ...action, status: 'failed', error: errorText(error), endedAt: ended }
            : action,
        ),
      })
      setProblem(problemForError(error))
    } finally {
      textFilter.reset()
    }
  }

  const steer = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !turn || snapshot.turnStatus !== 'running') return
    await turn.steer(trimmed).catch(() => undefined)
  }

  const cancel = () => {
    if (!turn || snapshot.turnStatus !== 'running') return
    commit({ turnStatus: 'cancelling' })
    turn.cancel()
  }

  const undo = (action: AgentAction) => {
    if (!action.undoId || !tools.undo.restore(action.undoId)) return false
    undoneLabels.push(action.label)
    return true
  }

  const selectSet = (set: ElementSet) => {
    const target = options.getViewer()
    if (!target?.model) return
    const ids = [...set.dbIds]
    target.select(ids)
    if (ids.length > 0) target.fitToView(ids)
  }

  const closeAgent = () => {
    turn?.cancel()
    turn = null
    const closing = agent
    agent = null
    if (closing) void closing.close().catch(() => undefined)
  }

  const reset = async () => {
    conversation += 1
    closeAgent()
    checkpoint = null
    undoneLabels = []
    tools.sets.clear()
    tools.undo.clear()
    if (problem?.status === 'error' || problem?.reason === 'rate-limited') problem = null
    commit({ messages: [], usage: EMPTY_USAGE, turnStatus: 'idle' })
    await persist(null)
    if (started) ensureAgent(lifetime)
  }

  const start = () => {
    if (started || typeof window === 'undefined') return
    started = true
    lifetime += 1
    cleanups = [
      tools.sets.subscribe(() => commit({ sets: tools.sets.list() })),
      tools.colors.subscribe(() => commit({ legend: tools.colors.legend() })),
      tools.undo.subscribe(syncUndoable),
    ]
    commit({ sets: tools.sets.list(), legend: tools.colors.legend() })
    void boot(lifetime)
  }

  const dispose = () => {
    if (!started) return
    started = false
    lifetime += 1
    closeAgent()
    stopPolling()
    if (pauseTimer !== null) clearTimeout(pauseTimer)
    pauseTimer = null
    detachViewer?.()
    detachViewer = null
    viewer = null
    for (const cleanup of cleanups) cleanup()
    cleanups = []
    commit({ turnStatus: 'idle' })
  }

  return {
    start,
    dispose,
    update(next) {
      options = { ...next, tools, storage: next.storage ?? options.storage }
      const modelLabel = next.modelLabel ?? modelLabelFor(modelId())
      if (modelLabel !== snapshot.modelLabel) commit({ modelLabel })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    send,
    steer,
    cancel,
    undo,
    selectSet,
    reset,
  }
}

/** Creates the agent once per `tools` instance, starts it on mount, and disposes it on unmount. */
export function useFxViewerAgent(options: FxViewerAgentOptions): FxViewerAgentState {
  const [entry, setEntry] = useState(() => ({
    tools: options.tools,
    agent: createFxViewerAgent(options),
  }))
  let { agent } = entry
  if (entry.tools !== options.tools) {
    agent = createFxViewerAgent(options)
    setEntry({ tools: options.tools, agent })
  }

  useEffect(() => {
    agent.update(options)
  })

  useEffect(() => {
    agent.start()
    return () => agent.dispose()
  }, [agent])

  const snapshot = useSyncExternalStore(agent.subscribe, agent.getSnapshot, agent.getServerSnapshot)

  return useMemo(
    () => ({
      ...snapshot,
      send: agent.send,
      steer: agent.steer,
      cancel: agent.cancel,
      undo: agent.undo,
      selectSet: agent.selectSet,
      reset: agent.reset,
    }),
    [snapshot, agent],
  )
}
