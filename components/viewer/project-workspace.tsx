'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { EdgePanel } from '@/components/panel/edge-panel'
import { useEdgeRun } from '@/components/panel/use-edge-run'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ProjectViewer } from '@/components/viewer/project-viewer'
import { StageLegend } from '@/components/viewer/stage-legend'
import { useViewer, ViewerBridgeProvider } from '@/components/viewer/viewer-bridge'
import type { OrientationRow } from '@/lib/edge/types'
import type { BucketModel } from '@/lib/models/types'
import { messages } from '@/lib/ui/messages'
import { dbIdsForType } from '@/lib/ui/mock-run'
import { clearTheming, colorByOrientation } from '@/lib/viewer/color'

export interface ProjectWorkspaceProps {
  model: BucketModel
  viewableName?: string
}

export function ProjectWorkspace({ model, viewableName }: ProjectWorkspaceProps) {
  const edge = useEdgeRun()
  const run = edge.store.run
  // Every new run starts coloured; the person turns colouring off per run.
  const [colourOffFor, setColourOffFor] = useState<string | null>(null)
  const colourOn = run !== null && colourOffFor !== run.runId
  const setColourOn = (on: boolean) => setColourOffFor(on ? null : (run?.runId ?? null))

  const rows = run?.measures.find((m) => m.code === 'EEM01')?.orientations

  return (
    <ViewerBridgeProvider>
      <div className="flex h-dvh flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4 text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            {messages.app}
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="truncate font-medium" data-testid="model-name">
            {model.name}
          </h1>
          {viewableName ? <span className="font-mono text-xs text-muted-foreground">{viewableName}</span> : null}
          <UnitsChip units={run?.snapshot.units} />
          <Link href="/" className="ml-auto text-xs text-muted-foreground hover:text-foreground" data-testid="projects-link">
            {messages.projects}
          </Link>
        </header>
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize="70%" minSize={320} className="min-w-0">
            <ProjectViewer urn={model.urn} viewableName={viewableName}>
              <StageColouring rows={colourOn ? rows : undefined} onClear={() => setColourOn(false)} />
            </ProjectViewer>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={400} minSize={380} maxSize={640} className="min-w-0">
            <EdgePanel
              run={run}
              state={edge.state}
              error={edge.store.error}
              elementsOf={dbIdsForType}
              colouring={{ on: colourOn && rows !== undefined, onChange: setColourOn }}
              onCheck={edge.check}
              onConfirmType={edge.confirmType}
              onDecideExclusion={edge.decideExclusion}
              onNorthChange={edge.setNorth}
              onExport={edge.markExported}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </ViewerBridgeProvider>
  )
}

function UnitsChip({ units }: { units?: string }) {
  const { viewer, isModelLoaded } = useViewer()
  const fromModel = isModelLoaded ? viewer?.model?.getUnitString() : undefined
  const shown = units ?? fromModel
  if (!shown) return null
  return (
    <span className="rounded-sm border px-1.5 py-px font-mono text-[11px] text-muted-foreground" data-testid="units-chip">
      {shown}
    </span>
  )
}

function StageColouring({ rows, onClear }: { rows: OrientationRow[] | undefined; onClear: () => void }) {
  const { viewer, isModelLoaded } = useViewer()
  const active = rows !== undefined && isModelLoaded && viewer !== null

  useEffect(() => {
    if (!viewer || !isModelLoaded) return
    if (rows) colorByOrientation(viewer, rows)
    else clearTheming(viewer)
    return () => clearTheming(viewer)
  }, [viewer, isModelLoaded, rows])

  return active ? <StageLegend onClear={onClear} /> : null
}
