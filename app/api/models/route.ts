import { connection } from 'next/server'
import { listBucketModels } from '@/lib/models/list'

export async function GET(): Promise<Response> {
  await connection()
  try {
    return Response.json(await listBucketModels(), {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (error) {
    console.error('Model listing failed', error)
    return Response.json({ error: 'The model list is unavailable.' }, { status: 503 })
  }
}
