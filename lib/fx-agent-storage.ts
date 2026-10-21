import type { Usage } from 'libfx/browser'
import type {
  AgentAction,
  AgentActionStatus,
  AgentMessage,
  AgentMessagePart,
  ElementSet,
} from '@/lib/agent-types'

export interface FxAgentUsage {
  turns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
}

/** What the user saw, kept beside libfx's opaque checkpoint so a reload can show it again. */
export interface FxAgentTranscript {
  messages: AgentMessage[]
  sets: ElementSet[]
  usage: FxAgentUsage
}

export interface FxAgentRecord {
  checkpoint: Uint8Array
  transcript: FxAgentTranscript
  savedAt: number
}

export interface FxAgentStorage {
  load(key: string): Promise<FxAgentRecord | null>
  save(key: string, record: FxAgentRecord): Promise<void>
  remove(key: string): Promise<void>
}

export const EMPTY_USAGE: FxAgentUsage = Object.freeze({
  turns: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
})

const CHECKPOINT_LIMIT = 4 * 1024 * 1024
const TRANSCRIPT_LIMIT = 2 * 1024 * 1024
const KEPT_IMAGES = 3
const OUTPUT_LIMIT = 8_000
const STORE = 'conversations'
const ACTION_STATUSES: readonly AgentActionStatus[] = [
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'partial',
]

function isActionStatus(value: unknown): value is AgentActionStatus {
  return ACTION_STATUSES.some((status) => status === value)
}

function compactAction(source: AgentAction, keepImage: boolean): AgentAction {
  const { image, ...rest } = source
  const action: AgentAction = keepImage && image ? { ...rest, image } : rest
  if (action.output === undefined) return action
  const text = typeof action.output === 'string' ? action.output : JSON.stringify(action.output)
  if (text !== undefined && text.length > OUTPUT_LIMIT)
    action.output = `${text.slice(0, OUTPUT_LIMIT)}…`
  return action
}

/** Drops all but the newest images, caps tool output, then drops the oldest messages to fit. */
export function serializeTranscript(
  transcript: FxAgentTranscript,
  limit = TRANSCRIPT_LIMIT,
): string {
  let images = 0
  const messages = [...transcript.messages].reverse().map((message) => {
    const parts: AgentMessagePart[] = []
    for (const part of [...message.parts].reverse()) {
      if (part.type === 'image') {
        images += 1
        if (images <= KEPT_IMAGES) parts.push(part)
        continue
      }
      if (part.type !== 'action') {
        parts.push(part)
        continue
      }
      if (part.action.image) images += 1
      const keepImage = images <= KEPT_IMAGES
      parts.push({ type: 'action', action: compactAction(part.action, keepImage) })
    }
    return { ...message, parts: parts.reverse() }
  })
  messages.reverse()
  let json = JSON.stringify({ ...transcript, messages })
  while (json.length > limit && messages.length > 1) {
    messages.shift()
    json = JSON.stringify({ ...transcript, messages })
  }
  return json
}

type Fields = ReadonlyMap<string, unknown>

function fieldsOf(value: unknown): Fields | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return new Map(Object.entries(value))
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readNumbers(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'number') : []
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readImage(fields: Fields | null): AgentAction['image'] {
  const mimeType = readString(fields?.get('mimeType'))
  const base64 = readString(fields?.get('base64'))
  return mimeType && base64 ? { mimeType, base64 } : undefined
}

function readAction(value: unknown): AgentAction | null {
  const fields = fieldsOf(value)
  const id = readString(fields?.get('id'))
  const tool = readString(fields?.get('tool'))
  if (!fields || !id || !tool) return null
  const status = fields.get('status')
  const action: AgentAction = {
    id,
    tool,
    label: readString(fields.get('label')) ?? tool,
    status: !isActionStatus(status) || status === 'running' ? 'cancelled' : status,
    startedAt: readNumber(fields.get('startedAt')),
    input: fields.get('input'),
    undoable: false,
  }
  const endedAt = readNumber(fields.get('endedAt'))
  if (endedAt) action.endedAt = endedAt
  const detail = readString(fields.get('detail'))
  if (detail !== undefined) action.detail = detail
  const error = readString(fields.get('error'))
  if (error !== undefined) action.error = error
  const setId = readString(fields.get('setId'))
  if (setId !== undefined) action.setId = setId
  const color = readString(fields.get('color'))
  if (color !== undefined) action.color = color
  if (fields.get('output') !== undefined) action.output = fields.get('output')
  const image = readImage(fieldsOf(fields.get('image')))
  if (image) action.image = image
  return action
}

function readPart(value: unknown): AgentMessagePart | null {
  const fields = fieldsOf(value)
  const type = fields?.get('type')
  const text = readString(fields?.get('text'))
  if ((type === 'text' || type === 'reasoning') && text !== undefined) return { type, text }
  if (type === 'action') {
    const action = readAction(fields?.get('action'))
    return action ? { type: 'action', action } : null
  }
  if (type === 'image') {
    const image = readImage(fields)
    return image ? { type: 'image', ...image, alt: readString(fields?.get('alt')) } : null
  }
  return null
}

function readMessage(value: unknown): AgentMessage | null {
  const fields = fieldsOf(value)
  const id = readString(fields?.get('id'))
  const role = fields?.get('role')
  const parts = fields?.get('parts')
  if (!id || (role !== 'user' && role !== 'assistant') || !Array.isArray(parts)) return null
  return {
    id,
    role,
    parts: parts.map(readPart).filter((part) => part !== null),
    createdAt: readNumber(fields?.get('createdAt')),
  }
}

function readSet(value: unknown): ElementSet | null {
  const fields = fieldsOf(value)
  const id = readString(fields?.get('id'))
  if (!fields || !id) return null
  return {
    id,
    label: readString(fields.get('label')) ?? id,
    dbIds: readNumbers(fields.get('dbIds')),
    createdAt: readNumber(fields.get('createdAt')),
    origin: readString(fields.get('origin')) ?? 'restored',
  }
}

function readList<T>(value: unknown, read: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(read).filter((item) => item !== null) : []
}

/** Restored actions are never undoable: the viewer snapshots behind them did not survive, and a
 * new page's undo ids start over. */
export function parseTranscript(json: string): FxAgentTranscript | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const fields = fieldsOf(parsed)
  if (!fields || !Array.isArray(fields.get('messages'))) return null
  const usage = fieldsOf(fields.get('usage'))
  return {
    messages: readList(fields.get('messages'), readMessage),
    sets: readList(fields.get('sets'), readSet),
    usage: {
      turns: readNumber(usage?.get('turns')),
      inputTokens: readNumber(usage?.get('inputTokens')),
      outputTokens: readNumber(usage?.get('outputTokens')),
      cacheReadTokens: readNumber(usage?.get('cacheReadTokens')),
      cacheWriteTokens: readNumber(usage?.get('cacheWriteTokens')),
      reasoningTokens: readNumber(usage?.get('reasoningTokens')),
    },
  }
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/** One object store in one database; each record is `{ checkpoint, transcript (JSON), savedAt }`. */
export function createIndexedDbStorage(databaseName = 'cantera-fx-agent'): FxAgentStorage {
  let database: Promise<IDBDatabase> | null = null

  const open = (): Promise<IDBDatabase> => {
    if (!database) {
      if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('IndexedDB is unavailable'))
      }
      const request = indexedDB.open(databaseName, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE)
        }
      }
      const pending = settle(request)
      database = pending
      pending.catch(() => {
        if (database === pending) database = null
      })
    }
    return database
  }

  const store = async (mode: IDBTransactionMode): Promise<IDBObjectStore> =>
    (await open()).transaction(STORE, mode).objectStore(STORE)

  return {
    async load(key) {
      const fields = fieldsOf(await settle((await store('readonly')).get(key)))
      const checkpoint = fields?.get('checkpoint')
      const json = readString(fields?.get('transcript'))
      if (!(checkpoint instanceof Uint8Array) || json === undefined) return null
      const transcript = parseTranscript(json)
      if (!transcript) return null
      return { checkpoint, transcript, savedAt: readNumber(fields?.get('savedAt')) }
    },
    async save(key, record) {
      if (record.checkpoint.byteLength > CHECKPOINT_LIMIT) {
        throw new Error('The conversation checkpoint is larger than 4 MiB')
      }
      const value = {
        checkpoint: record.checkpoint,
        transcript: serializeTranscript(record.transcript),
        savedAt: record.savedAt,
      }
      await settle((await store('readwrite')).put(value, key))
    },
    async remove(key) {
      await settle((await store('readwrite')).delete(key))
    },
  }
}

export function addUsage(total: FxAgentUsage, usage: Usage): FxAgentUsage {
  return {
    turns: total.turns + 1,
    inputTokens: total.inputTokens + (usage.inputTokens ?? 0),
    outputTokens: total.outputTokens + (usage.outputTokens ?? 0),
    cacheReadTokens: total.cacheReadTokens + (usage.cacheReadTokens ?? 0),
    cacheWriteTokens: total.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
    reasoningTokens: total.reasoningTokens + (usage.reasoningTokens ?? 0),
  }
}
