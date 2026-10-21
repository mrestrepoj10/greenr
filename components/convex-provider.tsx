'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { useMemo, type ReactNode } from 'react'

// The default logger draws a random listener id, which Cache Components rejects while prerendering the shell.
// The server never connects, so it needs no logger.
const SERVER = typeof window === 'undefined'

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const client = useMemo(() => (url ? new ConvexReactClient(url, SERVER ? { logger: false } : undefined) : null), [url])
  if (!client) return <>{children}</>
  return <ConvexProvider client={client}>{children}</ConvexProvider>
}
