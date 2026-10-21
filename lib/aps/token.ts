export const APS_BASE_URL = 'https://developer.api.autodesk.com'

export interface AccessToken {
  accessToken: string
  expiresAt: number
}

const REFRESH_MARGIN_MS = 60_000
const cache = new Map<string, Promise<AccessToken>>()

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.APS_CLIENT_ID
  const clientSecret = process.env.APS_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('APS credentials are not configured')
  return { clientId, clientSecret }
}

async function requestToken(scopes: readonly string[]): Promise<AccessToken> {
  const { clientId, clientSecret } = credentials()
  const response = await fetch(`${APS_BASE_URL}/authentication/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: scopes.join(' ') }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`APS token request failed (${response.status})`)
  const body = (await response.json()) as { access_token: string; expires_in: number }
  return { accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
}

/** A 2-legged token for `scopes`, reused until a minute before it expires. */
export async function getAppToken(scopes: readonly string[]): Promise<AccessToken> {
  const key = [...scopes].sort().join(' ')
  const pending = cache.get(key)
  if (pending) {
    const token = await pending.catch(() => null)
    if (token && token.expiresAt - Date.now() > REFRESH_MARGIN_MS) return token
  }
  const fresh = requestToken(scopes)
  cache.set(key, fresh)
  fresh.catch(() => cache.delete(key))
  return fresh
}

export function bucketKey(): string {
  if (process.env.APS_BUCKET) return process.env.APS_BUCKET
  const safe = (process.env.APS_CLIENT_ID ?? '').toLowerCase().replace(/[^-_.a-z0-9]/g, '')
  return `${safe.slice(0, 100)}-cantera-models`
}

export const pathSegment = (value: string): string =>
  encodeURIComponent(value).replaceAll('%3A', ':')

export async function apsGet<T>(path: string, scopes: readonly string[]): Promise<T | null> {
  const token = await getAppToken(scopes)
  const response = await fetch(`${APS_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token.accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`APS GET ${path} failed (${response.status})`)
  return (await response.json()) as T
}
