'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { APSViewer } from '@/components/ui/aps-viewer'
import { ViewerBridge } from '@/components/viewer/viewer-bridge'
import type { GetAccessToken } from '@/lib/viewer-types'

export interface ProjectViewerProps {
  urn: string
  viewableName?: string
}

export function ProjectViewer({ urn, viewableName }: ProjectViewerProps) {
  const [loaded, setLoaded] = useState(false)
  const getAccessToken = useCallback<GetAccessToken>(async () => {
    const response = await fetch('/api/viewer-token', { cache: 'no-store' })
    if (!response.ok) throw new Error('The viewer token is unavailable.')
    return (await response.json()) as Awaited<ReturnType<GetAccessToken>>
  }, [])

  return (
    <APSViewer
      urn={urn}
      viewableName={viewableName}
      getAccessToken={getAccessToken}
      profile="aec"
      className="h-full w-full"
      onModelLoaded={() => setLoaded(true)}
      onError={(error) => toast.error(error.message)}
    >
      <ViewerBridge />
      <div
        data-testid="viewer-state"
        data-state={loaded ? 'loaded' : 'loading'}
        className="pointer-events-none absolute top-2 left-2 rounded bg-background/70 px-2 py-1 font-mono text-xs text-muted-foreground"
      >
        {loaded ? (viewableName ?? 'default view') : 'loading model'}
      </div>
    </APSViewer>
  )
}
