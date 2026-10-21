'use client'

import { Palette } from 'lucide-react'
import { useCallback, useState } from 'react'
import { CompassRose } from '@/components/panel/compass-rose'
import { ConfirmationBlock } from '@/components/panel/confirmation-block'
import { DesignInputs } from '@/components/panel/design-inputs'
import { GapsList } from '@/components/panel/gaps-list'
import { InlineAlert } from '@/components/panel/inline-alert'
import { MeasureSection } from '@/components/panel/measure-section'
import { PanelEmpty, PanelSkeleton } from '@/components/panel/panel-empty'
import { PanelHeader } from '@/components/panel/panel-header'
import { WwrTable } from '@/components/panel/wwr-table'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useViewer } from '@/components/viewer/viewer-bridge'
import type { ElementRole, RunResult, RunState } from '@/lib/edge/types'
import { pendingTypes } from '@/lib/run/pipeline'
import { messages } from '@/lib/ui/messages'
import { isolateDbIds } from '@/lib/viewer/color'

export interface EdgePanelProps {
  run: RunResult | null
  state: RunState
  error?: string | null
  /** The phase line while a check runs, for example how many types are being classified. */
  progress?: string
  /** "stored" when the run shown is the last one saved for the project, not one measured in this session. */
  origin?: 'live' | 'stored' | null
  /** Element ids behind a type key, for isolating a pending type. */
  elementsOf?: (typeKey: string) => number[]
  colouring?: { on: boolean; onChange: (on: boolean) => void }
  onCheck?: () => void
  onConfirmType?: (typeKey: string, role: ElementRole) => void
  onDecideExclusion?: (id: string, accept: boolean) => void
  onNorthChange?: (angleDeg: number) => void
  onExport?: () => void
}

const noElements = () => []

export function EdgePanel({
  run,
  state,
  error,
  progress,
  origin,
  elementsOf = noElements,
  colouring,
  onCheck,
  onConfirmType,
  onDecideExclusion,
  onNorthChange,
  onExport,
}: EdgePanelProps) {
  const { viewer, isModelLoaded } = useViewer()
  // The selection belongs to one run, so a new run starts with nothing selected.
  const [selection, setSelection] = useState<{ runId?: string; key: string | null }>({ key: null })
  const selectedKey = selection.runId === run?.runId ? selection.key : null

  const select = useCallback(
    (key: string, dbIds: number[]) => {
      const next = selectedKey === key ? null : key
      setSelection({ runId: run?.runId, key: next })
      if (viewer && isModelLoaded) isolateDbIds(viewer, next ? dbIds : [])
    },
    [selectedKey, run?.runId, viewer, isModelLoaded],
  )

  const eem01 = run?.measures.find((m) => m.code === 'EEM01')
  const pending = run ? pendingTypes(run) : []
  const measuring = state === 'measuring' || state === 'snapshot' || state === 'classifying' || state === 'loading'

  return (
    <aside className="flex h-full min-h-0 flex-col bg-background" data-testid="edge-panel" data-state={state}>
      <PanelHeader state={state} hasRun={run !== null} onCheck={onCheck} onExport={onExport} />
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <ScrollArea className="min-h-0 flex-1">
        {measuring ? <PanelSkeleton status={progress} /> : null}
        {!measuring && !run ? <PanelEmpty /> : null}
        {!measuring && run ? (
          <>
            {origin === 'stored' ? (
              <p className="px-4 pb-2 text-xs text-muted-foreground" data-testid="stored-run">
                {messages.storedRun(new Date(run.computedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))}
              </p>
            ) : null}
            {run.state === 'provisional' ? (
              <p className="px-4 pb-3 text-xs text-muted-foreground">{messages.provisionalNote}</p>
            ) : null}
            <ConfirmationBlock
              pending={pending}
              exclusions={run.exclusions}
              selectedKey={selectedKey}
              onSelect={select}
              elementsOf={elementsOf}
              onConfirmType={onConfirmType}
              onDecideExclusion={onDecideExclusion}
            />
            {eem01?.orientations ? (
              <MeasureSection
                title={messages.wwr.title}
                guide={eem01.guide}
                testId="eem01"
                aside={
                  colouring ? (
                    <Button
                      size="xs"
                      variant={colouring.on ? 'secondary' : 'ghost'}
                      aria-pressed={colouring.on}
                      onClick={() => colouring.onChange(!colouring.on)}
                      disabled={!isModelLoaded}
                      data-testid="toggle-colour"
                    >
                      <Palette data-icon="inline-start" aria-hidden />
                      {colouring.on ? messages.wwr.clearColour : messages.wwr.colour}
                    </Button>
                  ) : null
                }
              >
                <WwrTable rows={eem01.orientations} selectedKey={selectedKey} onSelect={select} />
                <CompassRose north={run.snapshot.north} onNorthChange={onNorthChange} />
              </MeasureSection>
            ) : null}
            <MeasureSection title={messages.inputs.title} testId="design-inputs-section">
              <DesignInputs measures={run.measures} selectedKey={selectedKey} onSelect={select} />
            </MeasureSection>
            <MeasureSection title={messages.gaps.title} testId="gaps-section">
              <GapsList measures={run.measures} selectedKey={selectedKey} onSelect={select} />
            </MeasureSection>
          </>
        ) : null}
      </ScrollArea>
      <footer className="border-t px-4 py-2 text-[11px] leading-snug text-muted-foreground">{messages.footer}</footer>
    </aside>
  )
}
