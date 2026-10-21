'use client'

import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { APSViewer } from '@/components/ui/aps-viewer'
import { useViewer, ViewerBridge } from '@/components/viewer/viewer-bridge'
import { applyDarkStage } from '@/lib/viewer/color'
import type { GetAccessToken } from '@/lib/viewer-types'

export interface ProjectViewerProps {
  urn: string
  viewableName?: string
  /** Overlay UI over the canvas; every child can call `useViewer()`. */
  children?: ReactNode
}

export function ProjectViewer({ urn, viewableName, children }: ProjectViewerProps) {
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
      theme="dark"
      className="h-full w-full bg-background"
      onViewerReady={applyDarkStage}
      onModelLoaded={() => setLoaded(true)}
      onError={(error) => toast.error(error.message)}
    >
      <ViewerBridge />
      <DarkStage />
      <div
        data-testid="viewer-state"
        data-state={loaded ? 'loaded' : 'loading'}
        className="pointer-events-none absolute top-2 left-2 z-10 rounded bg-background/70 px-2 py-1 font-mono text-xs text-muted-foreground"
      >
        {loaded ? (viewableName ?? 'default view') : 'loading model'}
      </div>
      {children}
    </APSViewer>
  )
}

/** The AEC profile re-enables its lit environment when a model lands, so the stage is re-darkened then. */
function DarkStage() {
  const { viewer, isModelLoaded } = useViewer()
  useEffect(() => {
    if (viewer && isModelLoaded) applyDarkStage(viewer)
  }, [viewer, isModelLoaded])
  return null
}
