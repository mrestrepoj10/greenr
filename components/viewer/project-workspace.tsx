'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { DevTerminal, useDevHook, useDevMode } from '@/components/agent/dev-terminal'
import { EdgeAgentSection, useGreenrTools } from '@/components/agent/edge-agent'
import { EdgePanel } from '@/components/panel/edge-panel'
import { phaseMessage, useEdgeRun } from '@/components/panel/use-edge-run'
import { useExportPack } from '@/components/panel/use-export-pack'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ProjectViewer } from '@/components/viewer/project-viewer'
import { StageLegend } from '@/components/viewer/stage-legend'
import { useViewer, ViewerBridgeProvider } from '@/components/viewer/viewer-bridge'
import { elevationZeroZ } from '@/lib/edge/casa/elevation'
import { DEFAULT_SCOPE } from '@/lib/edge/run'
import type { OrientationRow, RunScope, Snapshot } from '@/lib/edge/types'
import type { BucketModel } from '@/lib/models/types'
import { useProject, useUpsertProject } from '@/lib/persist/hooks'
import { messages } from '@/lib/ui/messages'
import { clearTheming, colorByOrientation, ghostDbIds } from '@/lib/viewer/color'
import { hideFloodPlane, showFloodPlane } from '@/lib/viewer/flood-plane'

export interface ProjectWorkspaceProps {
  model: BucketModel
  viewableName?: string
}

export function ProjectWorkspace(props: ProjectWorkspaceProps) {
  return (
    <ViewerBridgeProvider>
      <Workspace {...props} />
    </ViewerBridgeProvider>
  )
}

/** The project row is keyed by slug. It is created once; later loads keep the north the person set. */
function useProjectRow(model: BucketModel, viewableName: string | undefined) {
  const project = useProject(model.slug)
  const upsert = useUpsertProject()
  useEffect(() => {
    if (project !== null) return
    void upsert({
      slug: model.slug,
      modelUrn: model.urn,
      modelName: model.name,
      viewableName: viewableName ?? '',
      viewableGuid: model.preferredViewable ?? '',
      northAngleDeg: 0,
      northSource: 'project',
    })
  }, [project, upsert, model, viewableName])
  return project ?? null
}

function Workspace({ model, viewableName }: ProjectWorkspaceProps) {
  const { viewer, getViewer, isModelLoaded } = useViewer()
  const project = useProjectRow(model, viewableName)
  const scope = useMemo<RunScope>(
    () => (project ? { schemes: project.schemes, inputs: project.inputs } : DEFAULT_SCOPE),
    [project],
  )
  const edge = useEdgeRun({
    projectId: project?._id ?? null,
    getViewer,
    userNorth: project?.northSource === 'user' ? project.northAngleDeg : undefined,
    scope,
  })
  const run = edge.run
  // Every new run starts coloured; the person turns colouring off per run.
  const [colourOffFor, setColourOffFor] = useState<string | null>(null)
  const colourOn = run !== null && colourOffFor !== run.runId
  const setColourOn = (on: boolean) => setColourOffFor(on ? null : (run?.runId ?? null))

  // The flood plane shows whenever CASA ran and a flood elevation is typed, until the person hides it.
  const [floodHidden, setFloodHidden] = useState(false)
  const floodElevation = scope.inputs.floodElevationM
  const floodLevelZ = floodElevation === undefined ? undefined : floodElevation - (scope.inputs.datumOffsetM ?? 0)
  const floodOn = floodLevelZ !== undefined && !floodHidden && run !== null && run.schemes.includes('CASA')

  const onInputsAllowed = project !== null && (isModelLoaded || !run)

  const rows = run?.measures.find((m) => m.code === 'EEM01')?.orientations
  const pack = useExportPack({ edge, getViewer, model, colouring: colourOn && rows !== undefined })
  const greenr = useGreenrTools(edge, getViewer)
  const dev = useDevMode()
  useDevHook(viewer, isModelLoaded, dev)

  return (
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
            <StageColouring
              rows={colourOn ? rows : undefined}
              ghost={colourOn ? edge.contextIds : undefined}
              onClear={() => setColourOn(false)}
            />
            <StageFloodPlane levelZ={floodOn ? floodLevelZ : undefined} ensureSnapshot={edge.ensureSnapshot} />
            {dev ? <DevTerminal greenr={greenr} /> : null}
          </ProjectViewer>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={400} minSize={380} maxSize={640} className="min-w-0">
          <EdgePanel
            run={run}
            state={edge.state}
            scope={scope}
            onSchemesChange={project && (isModelLoaded || !run) ? edge.setSchemes : undefined}
            onInputsChange={onInputsAllowed ? edge.setInputs : undefined}
            error={edge.error}
            progress={phaseMessage(edge.phase, scope.schemes)}
            exportView={pack.view}
            origin={edge.origin}
            elementsOf={edge.elementsOf}
            colouring={{ on: colourOn && rows !== undefined, onChange: setColourOn }}
            onCheck={isModelLoaded && project ? edge.check : undefined}
            onConfirmType={edge.confirmType}
            onUnconfirmType={edge.unconfirmType}
            onDecideExclusion={edge.decideExclusion}
            onNorthChange={edge.setNorth}
            onExport={pack.busy ? undefined : pack.exportPack}
            floodPlane={{ on: floodOn, onChange: (on) => setFloodHidden(!on), available: floodLevelZ !== undefined }}
            assistant={<EdgeAgentSection edge={edge} getViewer={getViewer} slug={model.slug} greenr={greenr} />}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
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

function StageColouring({
  rows,
  ghost,
  onClear,
}: {
  rows: OrientationRow[] | undefined
  ghost: number[] | undefined
  onClear: () => void
}) {
  const { viewer, isModelLoaded } = useViewer()
  const active = rows !== undefined && isModelLoaded && viewer !== null

  useEffect(() => {
    if (!viewer || !isModelLoaded) return
    clearTheming(viewer)
    if (ghost) ghostDbIds(viewer, ghost)
    if (rows) colorByOrientation(viewer, rows)
    return () => clearTheming(viewer)
  }, [viewer, isModelLoaded, rows, ghost])

  return active ? <StageLegend onClear={onClear} /> : null
}

/** The flood elevation drawn as a plane, `levelZ` metres above level elevation 0. The snapshot gives that datum's model z. */
function StageFloodPlane({ levelZ, ensureSnapshot }: { levelZ: number | undefined; ensureSnapshot: () => Promise<Snapshot> }) {
  const { viewer, isModelLoaded } = useViewer()

  useEffect(() => {
    if (!viewer || !isModelLoaded || levelZ === undefined) return
    let live = true
    ensureSnapshot()
      .then((snapshot) => {
        if (live) showFloodPlane(viewer, elevationZeroZ(snapshot) + levelZ)
      })
      .catch(() => {})
    return () => {
      live = false
      hideFloodPlane(viewer)
    }
  }, [viewer, isModelLoaded, levelZ, ensureSnapshot])

  return null
}
