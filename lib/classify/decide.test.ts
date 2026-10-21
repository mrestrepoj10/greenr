import { expect, test, vi } from 'vitest'
import { ELEMENT_ROLES } from '@/lib/edge/types'
import { decideRoles, type DecisionItem } from './decide'

const item: DecisionItem = {
  typeKey: 'Basic Wall / Generic - 200mm',
  category: 'Revit Walls',
  family: 'Basic Wall',
  typeName: 'Generic - 200mm',
  params: { Function: '' },
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('the decisions request is well formed and the answer becomes a model classification', async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse({
      model: 'typesafe-ai/jev',
      answers: { role: { type: 'choice', choice: 'interior-wall', probabilities: { 'interior-wall': 0.82, 'exterior-wall': 0.18 } } },
    }),
  )
  const [result] = await decideRoles([item], { apiKey: 'test-key', fetch: fetchMock as unknown as typeof fetch })

  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://ai-gateway.vercel.sh/v1/evaluate')
  expect(init.method).toBe('POST')
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key')
  const body = JSON.parse(init.body as string)
  expect(body.model).toBe('typesafe-ai/jev')
  expect(body.state).toEqual(item)
  expect(body.questions.role.type).toBe('choice')
  expect(Object.keys(body.questions.role.criteria).sort()).toEqual([...ELEMENT_ROLES].sort())
  expect(body.providerOptions.gateway.models[0]).toEqual({
    model: 'openai/gpt-6-luna-decisions',
    when: { question: 'role', confidenceBelow: 0.6 },
  })

  expect(result).toEqual({
    typeKey: item.typeKey,
    role: 'interior-wall',
    source: 'model',
    confidence: 0.82,
    reason: 'typesafe-ai/jev chose interior-wall',
  })
})

test('a fallback answer without probabilities keeps the role at confidence 0', async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse({ model: 'openai/gpt-6-luna-decisions', answers: { role: { type: 'choice', choice: 'shading', confidence: 0, probabilities: {} } } }),
  )
  const [result] = await decideRoles([item], { apiKey: 'k', fetch: fetchMock as unknown as typeof fetch })
  expect(result.role).toBe('shading')
  expect(result.confidence).toBe(0)
  expect(result.reason).toMatch(/without a probability/)
})

test('no key, an HTTP error, or a thrown fetch all yield other at confidence 0', async () => {
  const [noKey] = await decideRoles([item], { apiKey: '' , fetch: vi.fn() as unknown as typeof fetch })
  expect(noKey).toMatchObject({ role: 'other', source: 'model', confidence: 0 })
  expect(noKey.reason).toMatch(/decision model unavailable/)

  const [httpError] = await decideRoles([item], { apiKey: 'k', fetch: (async () => jsonResponse({ error: 'bad' }, 401)) as unknown as typeof fetch })
  expect(httpError).toMatchObject({ role: 'other', confidence: 0 })
  expect(httpError.reason).toMatch(/HTTP 401/)

  const [thrown] = await decideRoles([item], { apiKey: 'k', fetch: (async () => { throw new Error('offline') }) as unknown as typeof fetch })
  expect(thrown).toMatchObject({ role: 'other', confidence: 0 })
  expect(thrown.reason).toMatch(/offline/)
})

test('an answer outside ELEMENT_ROLES is treated as no role', async () => {
  const fetchMock = vi.fn(async () => jsonResponse({ answers: { role: { type: 'choice', choice: 'banana' } } }))
  const [result] = await decideRoles([item], { apiKey: 'k', fetch: fetchMock as unknown as typeof fetch })
  expect(result).toMatchObject({ role: 'other', confidence: 0 })
})
