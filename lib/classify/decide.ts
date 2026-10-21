import { ELEMENT_ROLES, type Classification, type ElementRole } from '@/lib/edge/types'

/** One leftover type, described for the decision model. */
export type DecisionItem = {
  typeKey: string
  category: string
  family: string
  typeName: string
  params: Record<string, string | number | null>
}

export type DecideOptions = {
  apiKey?: string
  endpoint?: string
  fetch?: typeof fetch
  primaryModel?: string
  fallbackModel?: string
  /** Choice confidence below which the gateway reruns the question on the fallback model. */
  fallbackBelow?: number
}

export const DECISIONS_ENDPOINT = 'https://ai-gateway.vercel.sh/v1/evaluate'
export const PRIMARY_MODEL = 'typesafe-ai/jev'
export const FALLBACK_MODEL = 'openai/gpt-6-luna-decisions'
export const FALLBACK_BELOW = 0.6
export const MAX_ITEMS_PER_REQUEST = 50

export const ROLE_CRITERIA: Record<ElementRole, string> = {
  'exterior-wall': 'An opaque wall between conditioned indoor space and the outdoors, including foundation walls',
  'interior-wall': 'A wall between two indoor spaces, a partition, a core or shaft wall',
  massing: 'A conceptual mass or massing wall, a placeholder volume, not real construction',
  parapet: 'A low wall above the roof line with no indoor space behind it',
  window: 'A window unit set in a wall',
  'curtain-glazed': 'A transparent or vision glass curtain wall panel',
  'curtain-solid': 'An opaque curtain wall panel: spandrel, metal, stone, wood or insulated panel',
  door: 'A door or glazed entrance',
  skylight: 'A window set in a roof, a rooflight',
  roof: 'A roof slab or roof assembly',
  floor: 'A floor slab',
  room: 'A room or space',
  shading: 'An external shading device: overhang, fin, louvre, brise soleil or its support',
  other: 'None of the above',
}

export const ROLE_QUESTION = {
  type: 'choice',
  instructions:
    'This is one Revit element type from an architectural model. Which EDGE envelope role does it play? Judge from the category, family, type name and parameters.',
  criteria: ROLE_CRITERIA,
} as const

export function decisionRequestBody(item: DecisionItem, options: DecideOptions = {}) {
  return {
    model: options.primaryModel ?? PRIMARY_MODEL,
    state: item,
    questions: { role: ROLE_QUESTION },
    providerOptions: {
      gateway: {
        models: [
          {
            model: options.fallbackModel ?? FALLBACK_MODEL,
            when: { question: 'role', confidenceBelow: options.fallbackBelow ?? FALLBACK_BELOW },
          },
        ],
      },
    },
  }
}

type ChoiceAnswer = {
  type: string
  choice?: string
  confidence?: number
  probabilities?: Record<string, number>
}

type DecisionResponse = {
  model?: string
  answers?: { role?: ChoiceAnswer }
}

const unavailable = (typeKey: string, reason: string): Classification => ({
  typeKey,
  role: 'other',
  source: 'model',
  confidence: 0,
  reason,
})

const isRole = (value: unknown): value is ElementRole =>
  typeof value === 'string' && (ELEMENT_ROLES as readonly string[]).includes(value)

export function classificationFromResponse(item: DecisionItem, body: DecisionResponse): Classification {
  const answer = body.answers?.role
  if (!answer || !isRole(answer.choice)) {
    return unavailable(item.typeKey, `decision model returned no role (${answer?.type ?? 'no answer'})`)
  }
  const probability = answer.probabilities?.[answer.choice]
  const confidence =
    typeof answer.confidence === 'number' && answer.confidence > 0
      ? answer.confidence
      : typeof probability === 'number'
        ? probability
        : 0
  const model = body.model ?? PRIMARY_MODEL
  return {
    typeKey: item.typeKey,
    role: answer.choice,
    source: 'model',
    confidence,
    reason: confidence > 0 ? `${model} chose ${answer.choice}` : `${model} chose ${answer.choice} without a probability`,
  }
}

async function decideOne(item: DecisionItem, apiKey: string, options: DecideOptions): Promise<Classification> {
  const doFetch = options.fetch ?? fetch
  try {
    const response = await doFetch(options.endpoint ?? DECISIONS_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(decisionRequestBody(item, options)),
    })
    if (!response.ok) {
      return unavailable(item.typeKey, `decision model unavailable (HTTP ${response.status})`)
    }
    return classificationFromResponse(item, (await response.json()) as DecisionResponse)
  } catch (error) {
    return unavailable(item.typeKey, `decision model unavailable (${error instanceof Error ? error.message : 'request failed'})`)
  }
}

/** Asks the decision model for one role per leftover type. Never throws: a missing key or a failed call yields confidence 0 so the UI asks the person. */
export async function decideRoles(items: DecisionItem[], options: DecideOptions = {}): Promise<Classification[]> {
  const apiKey = options.apiKey ?? process.env.AI_GATEWAY_API_KEY
  if (!apiKey) return items.map((item) => unavailable(item.typeKey, 'decision model unavailable (no AI_GATEWAY_API_KEY)'))
  return Promise.all(items.map((item) => decideOne(item, apiKey, options)))
}
