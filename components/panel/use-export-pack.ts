'use client'

import { useCallback, useState } from 'react'
import type { EdgeRun } from '@/components/panel/use-edge-run'
import { buildPack } from '@/lib/export/pack'
import type { BucketModel } from '@/lib/models/types'
import { useLatestPack, useSavePack } from '@/lib/persist/hooks'
import { messages } from '@/lib/ui/messages'
import { clearTheming, colorByOrientation, ghostDbIds } from '@/lib/viewer/color'
import { captureElevations, type ElevationSide } from '@/lib/viewer/elevations'
import type { APSViewer3D } from '@/lib/viewer-types'
import { version as APP_VERSION } from '@/package.json'

export type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'capturing'; side: ElevationSide }
  | { kind: 'packing' }
  | { kind: 'uploading' }
  | { kind: 'done'; url: string; size: number }
  | { kind: 'failed'; message: string }

/** What the panel shows for the evidence pack: work in progress, the share link, or why it failed. */
export type ExportView =
  | { kind: 'working'; message: string }
  | { kind: 'done'; url: string; size: number }
  | { kind: 'failed'; message: string }

function viewOf(status: ExportStatus): ExportView | null {
  switch (status.kind) {
    case 'idle':
      return null
    case 'capturing':
      return { kind: 'working', message: messages.exportStatus.capturing(status.side) }
    case 'packing':
      return { kind: 'working', message: messages.exportStatus.packing }
    case 'uploading':
      return { kind: 'working', message: messages.exportStatus.uploading }
    case 'done':
    case 'failed':
      return status
  }
}

export interface UseExportPackOptions {
  edge: EdgeRun
  getViewer: () => APSViewer3D | null
  model: BucketModel
  /** Whether the stage shows the WWR colours outside the export. Elevations are always coloured. */
  colouring: boolean
}

/** Elevations, pack, Blob upload, then the pack row and the exported state. Blocked while the run is provisional. */
export function useExportPack({ edge, getViewer, model, colouring }: UseExportPackOptions) {
  const [status, setStatus] = useState<ExportStatus>({ kind: 'idle' })
  const savePack = useSavePack()
  const stored = useLatestPack(edge.runDocId)

  const exportPack = useCallback(async () => {
    const run = edge.latestRun()
    const viewer = getViewer()
    if (!run || (run.state !== 'confirmed' && run.state !== 'exported') || !viewer?.model) return
    const rows = run.measures.find((m) => m.code === 'EEM01')?.orientations ?? []
    try {
      clearTheming(viewer)
      ghostDbIds(viewer, edge.contextIds)
      colorByOrientation(viewer, rows)
      const images = await captureElevations(viewer, {
        dbIds: rows.flatMap((r) => [...r.wallDbIds, ...r.glazingDbIds]),
        hide: edge.contextIds,
        northAngleDeg: run.snapshot.north.angleDeg,
        onSide: (side) => setStatus({ kind: 'capturing', side }),
      })
      setStatus({ kind: 'packing' })
      const pack = await buildPack(run, images, {
        projectName: model.name,
        modelName: model.name,
        author: messages.exportStatus.author,
        appVersion: APP_VERSION,
      })
      setStatus({ kind: 'uploading' })
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/zip', 'x-run-id': run.runId, 'x-project': model.slug },
        body: new Blob([pack.zip as BlobPart], { type: 'application/zip' }),
      })
      const body = (await response.json()) as { url?: string; size?: number; error?: string }
      if (!response.ok || !body.url) throw new Error(body.error ?? messages.exportStatus.failed)
      const runDocId = await edge.markExported()
      if (runDocId) await savePack(runDocId, body.url, body.size ?? pack.zip.byteLength, pack.manifest)
      setStatus({ kind: 'done', url: body.url, size: body.size ?? pack.zip.byteLength })
    } catch (error) {
      setStatus({ kind: 'failed', message: error instanceof Error && error.message ? error.message : messages.exportStatus.failed })
    } finally {
      if (!colouring) clearTheming(viewer)
    }
  }, [edge, getViewer, model, colouring, savePack])

  const view =
    viewOf(status) ??
    (stored && edge.run?.state === 'exported' ? ({ kind: 'done', url: stored.url, size: stored.size } as const) : null)
  return { exportPack, view, busy: status.kind === 'capturing' || status.kind === 'packing' || status.kind === 'uploading' }
}
