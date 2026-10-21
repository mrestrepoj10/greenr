import type { Agent, AgentOptions } from 'libfx/browser'
import type {
  AgentAction,
  AgentMessage,
  AgentNotice,
  AgentRuntimeStatus,
  AgentSelectionContext,
  AgentTurnStatus,
  AgentUnavailableReason,
  ElementSet,
} from '@/lib/agent-types'
import type { FxAgentStorage, FxAgentUsage } from '@/lib/fx-agent-storage'
import type { ColorLegendEntry, ViewerAgentTools } from '@/lib/viewer-agent-tools'

/** The slice of the viewer the agent reads; an `APSViewer3D` satisfies it. */
export interface FxAgentViewer {
  model: { isLoadDone(): boolean } | null
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
  getSelection(): number[]
  select(dbIds: number[]): void
  fitToView(dbIds?: number[] | null): void
}

export interface FxRuntime {
  supportsJspi(): boolean
  createFxAgent(options: AgentOptions): Promise<Agent>
}

export interface FxViewerAgentOptions {
  tools: ViewerAgentTools
  getViewer: () => FxAgentViewer | null
  /** Same-origin proxy that holds the AI Gateway key. */
  gatewayBase?: string
  model?: string
  modelLabel?: string
  /** A named effort makes libfx check the model catalog when the agent is created. */
  effort?: string
  /** Appended to `tools.instructions`. */
  instructions?: string
  /** IndexedDB key for the conversation; name the model in it. `null` disables persistence. */
  storageKey?: string | null
  storage?: FxAgentStorage
  /** Fires when the viewer or its model may have changed; without it the agent polls until a
   * viewer exists, then follows the viewer's own events. */
  subscribeViewer?: (listener: () => void) => () => void
  fetch?: typeof globalThis.fetch
  now?: () => number
  loadRuntime?: () => Promise<FxRuntime>
}

export interface FxViewerAgentSnapshot {
  messages: readonly AgentMessage[]
  turnStatus: AgentTurnStatus
  runtimeStatus: AgentRuntimeStatus
  notice: AgentNotice | null
  reason: AgentUnavailableReason | null
  modelLabel: string
  sets: readonly ElementSet[]
  legend: readonly ColorLegendEntry[]
  selection: AgentSelectionContext | null
  usage: FxAgentUsage
}

export interface FxSendOptions {
  includeSelection?: boolean
}

export interface FxViewerAgentActions {
  send(text: string, options?: FxSendOptions): Promise<void>
  /** Applied at the next model boundary of the running turn. */
  steer(text: string): Promise<void>
  cancel(): void
  undo(action: AgentAction): boolean
  selectSet(set: ElementSet): void
  /** Starts a new conversation and clears the stored one. */
  reset(): Promise<void>
}

export interface FxViewerAgent extends FxViewerAgentActions {
  start(): void
  dispose(): void
  /** Later options apply from the next viewer lookup or agent creation; `tools` is fixed. */
  update(options: FxViewerAgentOptions): void
  subscribe(listener: () => void): () => void
  getSnapshot(): FxViewerAgentSnapshot
  getServerSnapshot(): FxViewerAgentSnapshot
}

export type FxViewerAgentState = FxViewerAgentSnapshot & FxViewerAgentActions
