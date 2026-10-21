'use client'

import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnswerProvider, AnswerText } from '@/components/agent/answer-cards'
import { QuestionWidget } from '@/components/agent/question-widget'
import type { EdgeRun } from '@/components/panel/use-edge-run'
import { AgentComposer, AgentNoticeView, AgentTranscript } from '@/components/ui/agent-panel'
import { Button } from '@/components/ui/button'
import { groupByType } from '@/lib/classify'
import type { Snapshot } from '@/lib/edge/types'
import { edgeToolSpecs, type EdgeSession } from '@/lib/agent/edge-tools'
import { ANSWER_INSTRUCTIONS } from '@/lib/agent/answer'
import { GREENR_INSTRUCTIONS } from '@/lib/agent/instructions'
import { AGENT_MODELS, DEFAULT_AGENT_MODEL, GATEWAY_BASE, isAgentModel, type AgentModelId } from '@/lib/agent/models'
import { ASK_USER_QUESTION, askUserQuestionTool, QuestionBroker } from '@/lib/agent/question'
import { createAgentTools, fromKitTool, type AgentTools } from '@/lib/agent/registry'
import { useFxViewerAgent } from '@/lib/fx-agent-preset'
import { openExclusions, pendingTypes } from '@/lib/run/pipeline'
import { messages } from '@/lib/ui/messages'
import { cn } from '@/lib/utils'
import { createViewerAgentTools, type ViewerAgentTools } from '@/lib/viewer-agent-tools'
import { selectDbIds } from '@/lib/viewer/color'
import type { APSViewer3D } from '@/lib/viewer-types'

const INSTRUCTIONS = `${GREENR_INSTRUCTIONS}\n\n${ANSWER_INSTRUCTIONS}`

/** The viewer kit tools greenr hands the agent; the rest of the kit stays out of its way. */
const KIT_TOOLS = new Set([
  'find_elements',
  'get_properties',
  'list_levels',
  'run_query',
  'color_elements',
  'isolate_elements',
  'take_screenshot',
  'show_all',
  'clear_colors',
])

const MODEL_STORAGE_KEY = 'greenr-agent-model'

/** The model choice is a per-browser convenience, kept in localStorage and read as an external store. */
const modelChoice = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    modelChoice.listeners.add(listener)
    return () => {
      modelChoice.listeners.delete(listener)
    }
  },
  get(): AgentModelId {
    try {
      const value = window.localStorage.getItem(MODEL_STORAGE_KEY)
      return isAgentModel(value) ? value : DEFAULT_AGENT_MODEL
    } catch {
      return DEFAULT_AGENT_MODEL
    }
  },
  set(model: AgentModelId) {
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, model)
    } catch {}
    for (const listener of modelChoice.listeners) listener()
  },
}

/** Holds the latest run hook result for tools that run outside render. */
class EdgeBox {
  private value: EdgeRun
  constructor(value: EdgeRun) {
    this.value = value
  }
  get = () => this.value
  set = (value: EdgeRun) => {
    this.value = value
  }
}

/** One registry for the chat panel and the dev terminal: the viewer kit subset, the EDGE tools and the question tool. */
export function createGreenrTools(
  getViewer: () => APSViewer3D | null,
  session: () => EdgeRun,
  broker: QuestionBroker,
): { kit: ViewerAgentTools; registry: AgentTools } {
  const kit = createViewerAgentTools(getViewer)
  const indexes = new WeakMap<Snapshot, Map<string, number[]>>()
  let index: Map<string, number[]> = new Map()
  const edge: EdgeSession = {
    run: () => session().latestRun(),
    elementsOf: (typeKey) => index.get(typeKey) ?? session().elementsOf(typeKey),
    proposeExclusion: (exclusion) => session().proposeExclusion(exclusion),
    proposeClassification: (typeKey, role, reason) => session().proposeClassification(typeKey, role, reason),
    resolveSet: (id) => (id === 'selection' ? getViewer()?.getSelection() : kit.sets.get(id)?.dbIds),
  }
  const withSnapshot = <T extends (...args: never[]) => Promise<unknown>>(run: T): T =>
    (async (...args: Parameters<T>) => {
      const snapshot = await session().ensureSnapshot()
      index = indexes.get(snapshot) ?? new Map([...groupByType(snapshot.elements).values()].map((g) => [g.typeKey, g.dbIds]))
      indexes.set(snapshot, index)
      return run(...args)
    }) as T
  const edgeSpecs = edgeToolSpecs(edge).map((spec) =>
    spec.name === 'edge_pending' || spec.name === 'edge_set_classification' ? { ...spec, run: withSnapshot(spec.run) } : spec,
  )
  const registry = createAgentTools([
    ...kit.tools.filter((tool) => KIT_TOOLS.has(tool.name)).map(fromKitTool),
    ...edgeSpecs,
    askUserQuestionTool(broker),
  ])
  return { kit, registry }
}

export type GreenrTools = ReturnType<typeof createGreenrTools> & { broker: QuestionBroker }

/** The tool registry for this page, built once; the tools read the latest run through a box the hook keeps current. */
export function useGreenrTools(edge: EdgeRun, getViewer: () => APSViewer3D | null): GreenrTools {
  const [box] = useState(() => new EdgeBox(edge))
  useEffect(() => box.set(edge), [box, edge])
  const [tools] = useState(() => {
    const broker = new QuestionBroker()
    return { ...createGreenrTools(getViewer, box.get, broker), broker }
  })
  useEffect(() => () => tools.kit.dispose(), [tools])
  return tools
}

export interface EdgeAgentProps {
  edge: EdgeRun
  getViewer: () => APSViewer3D | null
  slug: string
  greenr: GreenrTools
}

/** The assistant at the bottom of the EDGE panel: transcript with tool rows, inline questions, composer. */
export function EdgeAgentSection({ edge, getViewer, slug, greenr }: EdgeAgentProps) {
  const { kit, registry, broker } = greenr
  const tools = useMemo(() => ({ ...kit, tools: registry.asAgentTools(), instructions: '' }), [kit, registry])

  const model = useSyncExternalStore(modelChoice.subscribe, modelChoice.get, () => DEFAULT_AGENT_MODEL)
  const agent = useFxViewerAgent({
    tools,
    getViewer,
    gatewayBase: GATEWAY_BASE,
    model,
    modelLabel: AGENT_MODELS.find((m) => m.id === model)?.label,
    instructions: INSTRUCTIONS,
    storageKey: `greenr-agent:${slug}:${model}`,
  })

  // A switch from the picker starts a new conversation once the preset has taken the new model.
  const switched = useRef(false)
  const { reset } = agent
  useEffect(() => {
    if (!switched.current) return
    switched.current = false
    void reset()
  }, [model, reset])

  const greeted = useRef(new Set<string>())
  const { send, runtimeStatus, turnStatus } = agent
  const { run, origin } = edge
  useEffect(() => {
    if (!run || origin !== 'live' || runtimeStatus !== 'ready' || turnStatus !== 'idle') return
    if (greeted.current.has(run.runId)) return
    if (pendingTypes(run).length + openExclusions(run).length === 0) return
    greeted.current.add(run.runId)
    void send(messages.agent.firstTurn)
  }, [run, origin, runtimeStatus, turnStatus, send])

  const answers = useMemo(
    () => ({
      run,
      select: (dbIds: readonly number[]) => {
        const viewer = getViewer()
        if (viewer?.model && dbIds.length > 0) selectDbIds(viewer, dbIds)
      },
      resolveSet: (id: string) => (id === 'selection' ? getViewer()?.getSelection() : kit.sets.get(id)?.dbIds),
      send: (text: string) => void send(text),
    }),
    [run, getViewer, kit, send],
  )

  const [openChoice, setOpenChoice] = useState<boolean | null>(null)
  const open = openChoice ?? (agent.messages.length > 0 || agent.turnStatus !== 'idle')

  return (
    <section
      className={cn('flex min-h-0 flex-col border-t', open && 'h-[48%] shrink-0')}
      data-testid="agent-section"
      data-open={open}
      data-runtime={agent.runtimeStatus}
      data-turn={agent.turnStatus}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 px-4">
        <button
          type="button"
          onClick={() => setOpenChoice(!open)}
          aria-expanded={open}
          aria-label={open ? messages.agent.collapse : messages.agent.expand}
          className="flex items-center gap-1.5 rounded-sm text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          data-testid="agent-toggle"
        >
          {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />}
          {messages.agent.title}
        </button>
        <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <span className="sr-only">{messages.agent.model}</span>
          <select
            value={model}
            onChange={(event) => {
              switched.current = true
              modelChoice.set(event.target.value as AgentModelId)
            }}
            className="h-6 rounded-md border border-input bg-input/30 px-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            data-testid="agent-model"
          >
            {AGENT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <Button size="icon-xs" variant="ghost" onClick={() => void agent.reset()} aria-label={messages.agent.newConversation} title={messages.agent.newConversation}>
          <Plus aria-hidden />
        </Button>
      </header>
      {open ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {agent.notice ? <AgentNoticeView notice={agent.notice} className="mx-4 mb-2" /> : null}
          <AnswerProvider value={answers}>
            <AgentTranscript
              messages={agent.messages}
              turnStatus={agent.turnStatus}
              sets={agent.sets}
              assistantLabel={messages.agent.heading}
              emptyState={messages.agent.empty}
              onUndo={agent.undo}
              onSelectSet={agent.selectSet}
              renderAction={(action) =>
                action.tool === ASK_USER_QUESTION ? <QuestionWidget action={action} broker={broker} /> : undefined
              }
              renderText={(text, streaming) => <AnswerText text={text} streaming={streaming} />}
              data-testid="agent-transcript"
            />
          </AnswerProvider>
          <AgentComposer
            turnStatus={agent.turnStatus}
            runtimeStatus={agent.runtimeStatus}
            onSend={agent.send}
            onCancel={agent.cancel}
            onSteer={agent.steer}
            placeholder={messages.agent.placeholder}
            className="border-t px-3 py-2"
          />
        </div>
      ) : null}
    </section>
  )
}
