import { connection } from 'next/server'
import { getAppToken } from '@/lib/aps/token'

const VIEWER_SCOPES = ['viewables:read'] as const

export async function GET(): Promise<Response> {
  await connection()
  try {
    const token = await getAppToken(VIEWER_SCOPES)
    return Response.json(
      {
        accessToken: token.accessToken,
        expiresInSeconds: Math.max(1, Math.floor((token.expiresAt - Date.now()) / 1000)),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Viewer token request failed', error)
    return Response.json(
      { error: 'The viewer token is unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
