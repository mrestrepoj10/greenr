import {
  type AgentNotice,
  type AgentRuntimeStatus,
  type AgentUnavailableReason,
  describeAgentUnavailableReason,
} from '@/lib/agent-types'

export const AI_GATEWAY_ORIGIN = 'https://ai-gateway.vercel.sh'

const REFUSAL_STATUSES = new Set([400, 403, 413, 429, 503])

export interface GatewayRefusal {
  status: number
  /** The proxy's `error.type`, e.g. `model-not-allowed`. */
  type: string
  message: string
}

export interface GatewayFetchOptions {
  /** Same-origin proxy that holds the AI Gateway key, e.g. `/api/agent/gateway`. */
  base: string
  fetch?: typeof globalThis.fetch
  onRefusal?: (refusal: GatewayRefusal) => void
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function blocked(target: string): Response {
  return Response.json(
    {
      error: {
        type: 'blocked-origin',
        message: `The agent does not send requests to ${target}.`,
      },
    },
    { status: 403 },
  )
}

async function readRefusal(response: Response): Promise<GatewayRefusal | null> {
  if (!REFUSAL_STATUSES.has(response.status)) return null
  try {
    const body: { error?: { type?: unknown; message?: unknown } } = await response.clone().json()
    const type = body.error?.type
    const message = body.error?.message
    if (typeof type !== 'string' || typeof message !== 'string') return null
    return { status: response.status, type, message }
  } catch {
    return null
  }
}

function resolveBase(base: string): string {
  const trimmed = base.replace(/\/+$/, '')
  if (/^https?:\/\//.test(trimmed)) return trimmed
  const origin = globalThis.location?.origin
  return origin ? `${origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}` : trimmed
}

/** libfx's `fetch`: Gateway calls go to the same-origin proxy, every other origin gets a local 403. */
export function createGatewayFetch(options: GatewayFetchOptions): typeof globalThis.fetch {
  return async (input, init) => {
    const send = options.fetch ?? globalThis.fetch.bind(globalThis)
    const raw = requestUrl(input)
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return blocked(raw)
    }
    if (url.origin !== AI_GATEWAY_ORIGIN) return blocked(`${url.origin}${url.pathname}`)
    const target = `${resolveBase(options.base)}${url.pathname}${url.search}`
    const response =
      input instanceof Request
        ? await send(new Request(target, input), init)
        : await send(target, init)
    const refusal = await readRefusal(response)
    if (refusal) options.onRefusal?.(refusal)
    return response
  }
}

const FAKE_ERROR_TEXT = /^HTTP \d{3}: /

/** After a proxy refusal libfx streams the response as a `HTTP 4xx: {...}` text delta; this
 * holds deltas back until they prove to be that text (dropped) or real output (released). */
export class RefusalTextFilter {
  private armed = false
  private held = ''
  private dropping = false

  arm(): void {
    this.armed = true
  }

  reset(): void {
    this.armed = false
    this.held = ''
    this.dropping = false
  }

  /** Returns the text to show now, possibly empty. */
  push(delta: string): string {
    if (this.dropping) return ''
    if (!this.armed) return delta
    this.held += delta
    if (FAKE_ERROR_TEXT.test(this.held)) {
      this.dropping = true
      this.held = ''
      return ''
    }
    if (this.held.length >= 10 || !'HTTP 000: '.startsWith(this.held.replace(/\d/g, '0'))) {
      const released = this.held
      this.reset()
      return released
    }
    return ''
  }

  /** A non-text event ends the current run of deltas. */
  flush(): string {
    const released = this.dropping ? '' : this.held
    this.held = ''
    this.dropping = false
    return released
  }
}

/** Why the runtime cannot take a prompt right now, as the snapshot reports it. */
export interface AgentProblem {
  status: AgentRuntimeStatus
  reason: AgentUnavailableReason | null
  notice: AgentNotice
}

export function problemForRefusal(refusal: GatewayRefusal): AgentProblem {
  switch (refusal.type) {
    case 'not-configured':
    case 'rate-limited':
    case 'model-not-allowed':
      return {
        status: 'unavailable',
        reason: refusal.type,
        notice: describeAgentUnavailableReason(refusal.type),
      }
    case 'too-large':
      return {
        status: 'error',
        reason: null,
        notice: {
          title: 'This conversation is too long',
          description: `${refusal.message} Start a new conversation to keep going.`,
          tone: 'warning',
        },
      }
    default:
      return {
        status: 'error',
        reason: null,
        notice: {
          title: 'The model proxy refused the request',
          description: refusal.message,
          tone: 'danger',
        },
      }
  }
}

export function problemForError(error: unknown): AgentProblem {
  const fallback = describeAgentUnavailableReason('runtime-error')
  const detail = (error instanceof Error ? error.message : String(error)).replace(/\.$/, '')
  return {
    status: 'error',
    reason: 'runtime-error',
    notice: { ...fallback, description: `${detail}. ${fallback.description}` },
  }
}
