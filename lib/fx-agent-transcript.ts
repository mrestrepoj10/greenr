import type { HostTool, HostToolResult, ImageMimeType } from 'libfx/browser'
import type {
  AgentAction,
  AgentImage,
  AgentMessage,
  AgentMessagePart,
  AgentTool,
  AgentToolResult,
  JsonValue,
} from '@/lib/agent-types'

const TOOL_IMAGE_TYPES: readonly ImageMimeType[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]

function toolImageType(mimeType: string): ImageMimeType | null {
  return TOOL_IMAGE_TYPES.find((type) => type === mimeType) ?? null
}

/** The model reads `result.text`; a screenshot rides along as a libfx image result. */
export function toHostResult(result: AgentToolResult): HostToolResult {
  const mimeType = result.image ? toolImageType(result.image.mimeType) : null
  if (!result.image || !mimeType) return result.text
  return {
    type: 'libfx.tool-result',
    text: result.text,
    images: [{ type: 'image', mimeType, data: result.image.base64 }],
  }
}

export function toHostTool(tool: AgentTool, execute: HostTool['execute']): HostTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: JSON.parse(JSON.stringify(tool.inputSchema)),
    execute,
  }
}

export function humanizeToolName(name: string): string {
  const words = name.replace(/[_-]+/g, ' ').trim()
  return words ? `${words[0].toUpperCase()}${words.slice(1)}` : name
}

/** Turns `anthropic/claude-haiku-5.5` into `Claude Haiku 5.5`. */
export function modelLabelFor(model: string): string {
  const name = model.includes('/') ? model.slice(model.indexOf('/') + 1) : model
  return name
    .split('-')
    .filter(Boolean)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

export function parseToolOutput(text: string | undefined): JsonValue | undefined {
  if (text === undefined) return undefined
  try {
    const parsed: JsonValue = JSON.parse(text)
    return parsed
  } catch {
    return text
  }
}

export function inputKey(input: unknown): string {
  try {
    return JSON.stringify(input) ?? ''
  } catch {
    return ''
  }
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'Unknown error'
}

export function finishAction(
  action: AgentAction,
  outcome: { result?: AgentToolResult; error?: string; content?: string; isError: boolean },
  endedAt: number,
  hasUndo: (undoId: string) => boolean,
): AgentAction {
  const { result } = outcome
  if (outcome.isError || outcome.error !== undefined || !result) {
    const failed = outcome.isError || outcome.error !== undefined
    return {
      ...action,
      status: failed ? 'failed' : 'succeeded',
      endedAt,
      output: failed ? undefined : parseToolOutput(outcome.content),
      error: failed ? (outcome.error ?? outcome.content ?? 'The tool failed') : undefined,
    }
  }
  const finished: AgentAction = {
    ...action,
    label: result.label,
    status: result.partial ? 'partial' : 'succeeded',
    endedAt,
    output: parseToolOutput(result.text),
    undoable: result.undoId !== undefined && hasUndo(result.undoId),
  }
  if (result.detail !== undefined) finished.detail = result.detail
  if (result.undoId !== undefined) finished.undoId = result.undoId
  if (result.setId !== undefined) finished.setId = result.setId
  if (result.color !== undefined) finished.color = result.color
  if (result.image) finished.image = toActionImage(result.image)
  return finished
}

function toActionImage(image: AgentImage): AgentImage {
  const copy: AgentImage = { mimeType: image.mimeType, base64: image.base64 }
  if (image.width !== undefined) copy.width = image.width
  if (image.height !== undefined) copy.height = image.height
  return copy
}

export function appendMessage(
  messages: readonly AgentMessage[],
  message: AgentMessage,
): readonly AgentMessage[] {
  return [...messages, message]
}

function withLastAssistant(
  messages: readonly AgentMessage[],
  createId: () => string,
  createdAt: number,
  update: (parts: AgentMessagePart[]) => AgentMessagePart[],
): readonly AgentMessage[] {
  const last = messages.at(-1)
  if (last?.role === 'assistant') {
    return [...messages.slice(0, -1), { ...last, parts: update([...last.parts]) }]
  }
  return [...messages, { id: createId(), role: 'assistant', createdAt, parts: update([]) }]
}

export function appendDelta(
  messages: readonly AgentMessage[],
  kind: 'text' | 'reasoning',
  delta: string,
  createId: () => string,
  createdAt: number,
): readonly AgentMessage[] {
  return withLastAssistant(messages, createId, createdAt, (parts) => {
    const tail = parts.at(-1)
    if (tail?.type === kind) {
      parts[parts.length - 1] = { type: kind, text: tail.text + delta }
    } else {
      parts.push({ type: kind, text: delta })
    }
    return parts
  })
}

export function appendAction(
  messages: readonly AgentMessage[],
  action: AgentAction,
  createId: () => string,
  createdAt: number,
): readonly AgentMessage[] {
  return withLastAssistant(messages, createId, createdAt, (parts) => [
    ...parts,
    { type: 'action', action },
  ])
}

/** Returns the same array when `update` changed nothing, so snapshots stay referentially stable. */
export function mapActions(
  messages: readonly AgentMessage[],
  update: (action: AgentAction) => AgentAction,
): readonly AgentMessage[] {
  let changed = false
  const next = messages.map((message) => {
    let touched = false
    const parts = message.parts.map((part) => {
      if (part.type !== 'action') return part
      const action = update(part.action)
      if (action === part.action) return part
      touched = true
      return { type: 'action' as const, action }
    })
    if (!touched) return message
    changed = true
    return { ...message, parts }
  })
  return changed ? next : messages
}
