import { connection } from 'next/server'
import { decideRoles, MAX_ITEMS_PER_REQUEST, type DecisionItem } from '@/lib/classify/decide'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseItem(value: unknown): DecisionItem | null {
  if (!isRecord(value) || typeof value.typeKey !== 'string' || typeof value.category !== 'string') return null
  const params = isRecord(value.params) ? value.params : {}
  return {
    typeKey: value.typeKey,
    category: value.category,
    family: typeof value.family === 'string' ? value.family : '',
    typeName: typeof value.typeName === 'string' ? value.typeName : '',
    params: Object.fromEntries(
      Object.entries(params).filter(([, v]) => typeof v === 'string' || typeof v === 'number' || v === null),
    ) as DecisionItem['params'],
  }
}

export async function POST(request: Request): Promise<Response> {
  await connection()
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 })
  }
  const raw = isRecord(body) && Array.isArray(body.items) ? body.items : null
  if (!raw) return Response.json({ error: 'Body must be { items: DecisionItem[] }.' }, { status: 400 })
  if (raw.length > MAX_ITEMS_PER_REQUEST) {
    return Response.json({ error: `At most ${MAX_ITEMS_PER_REQUEST} items per request.` }, { status: 400 })
  }
  const items = raw.map(parseItem)
  if (items.some((item) => item === null)) {
    return Response.json({ error: 'Each item needs a string typeKey and category.' }, { status: 400 })
  }
  const classifications = await decideRoles(items as DecisionItem[])
  return Response.json({ classifications })
}
