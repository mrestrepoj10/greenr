import { MAX_ITEMS_PER_REQUEST, type DecisionItem } from '@/lib/classify'
import type { Classification } from '@/lib/edge/types'

/** Leftover types go to the decision route in batches the route accepts, all batches at once. */
export async function classifyRemote(items: DecisionItem[], signal?: AbortSignal): Promise<Classification[]> {
  const batches: DecisionItem[][] = []
  for (let i = 0; i < items.length; i += MAX_ITEMS_PER_REQUEST) batches.push(items.slice(i, i + MAX_ITEMS_PER_REQUEST))
  const answers = await Promise.all(
    batches.map(async (batch) => {
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: batch }),
        signal,
      })
      if (!response.ok) throw new Error(`classify returned ${response.status}`)
      return ((await response.json()) as { classifications: Classification[] }).classifications
    }),
  )
  return answers.flat()
}
