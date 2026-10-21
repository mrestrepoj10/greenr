'use client'

import { Palette } from 'lucide-react'
import type { ComponentType } from 'react'
import { CompassRose } from '@/components/panel/compass-rose'
import { DesignInputs } from '@/components/panel/design-inputs'
import { GapsList } from '@/components/panel/gaps-list'
import { MeasureSection } from '@/components/panel/measure-section'
import { WwrTable } from '@/components/panel/wwr-table'
import { Button } from '@/components/ui/button'
import { MEASURES } from '@/lib/edge/measures'
import { isCodeOf, schemeOf, type MeasureCode, type MeasureResult, type RunResult, type Scheme } from '@/lib/edge/types'
import { blockerText, messages } from '@/lib/ui/messages'

const DESIGN_INPUT_CODES: readonly MeasureCode[] = ['D-GIA', 'D-FLOORS', 'D-F2F', 'D-ROOF', 'AU-SKYLIGHT']

export interface SchemeResultsProps {
  run: RunResult
  measures: MeasureResult[]
  selectedKey: string | null
  onSelect: (key: string, dbIds: number[]) => void
  colouring?: { on: boolean; onChange: (on: boolean) => void; available: boolean }
  onNorthChange?: (angleDeg: number) => void
}

function EdgeResults({ run, measures, selectedKey, onSelect, colouring, onNorthChange }: SchemeResultsProps) {
  const eem01 = measures.find((m) => m.code === 'EEM01')
  const designInputs = DESIGN_INPUT_CODES.flatMap((code) => measures.filter((m) => m.code === code))
  return (
    <>
      {eem01?.orientations ? (
        <MeasureSection
          title={messages.wwr.title}
          guide={eem01.guide}
          credits={MEASURES.EEM01.credits}
          testId="eem01"
          code="EEM01"
          aside={
            colouring ? (
              <Button
                size="xs"
                variant={colouring.on ? 'secondary' : 'ghost'}
                aria-pressed={colouring.on}
                onClick={() => colouring.onChange(!colouring.on)}
                disabled={!colouring.available}
                data-testid="toggle-colour"
              >
                <Palette data-icon="inline-start" aria-hidden />
                {colouring.on ? messages.wwr.clearColour : messages.wwr.colour}
              </Button>
            ) : null
          }
        >
          <WwrTable rows={eem01.orientations} selectedKey={selectedKey} onSelect={onSelect} />
          <CompassRose north={run.snapshot.north} onNorthChange={onNorthChange} />
        </MeasureSection>
      ) : null}
      <MeasureSection title={messages.inputs.title} testId="design-inputs-section">
        <DesignInputs measures={designInputs} selectedKey={selectedKey} onSelect={onSelect} />
      </MeasureSection>
      <MeasureSection title={messages.gaps.title} testId="gaps-section">
        <GapsList scheme="EDGE" measures={measures} selectedKey={selectedKey} onSelect={onSelect} />
      </MeasureSection>
    </>
  )
}

function CasaResults({ measures, selectedKey, onSelect }: SchemeResultsProps) {
  return (
    <>
      {measures.map((m) => {
        const code = m.code
        if (!isCodeOf('CASA', code)) return null
        return (
          <MeasureSection
            key={code}
            title={messages.casa.titles[code]}
            guide={m.guide}
            credits={MEASURES[code].credits}
            testId="casa-measure"
            code={code}
          >
            {m.blockedBy?.length ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground" data-testid="measure-blocked">
                {m.blockedBy.map((blocker) => (
                  <li key={JSON.stringify(blocker)}>{blockerText(blocker)}</li>
                ))}
              </ul>
            ) : null}
            {m.inputs.length > 0 ? <DesignInputs measures={[m]} selectedKey={selectedKey} onSelect={onSelect} /> : null}
          </MeasureSection>
        )
      })}
      <MeasureSection title={messages.gaps.title} testId="gaps-section">
        <GapsList scheme="CASA" measures={measures} selectedKey={selectedKey} onSelect={onSelect} />
      </MeasureSection>
    </>
  )
}

const RESULTS: Record<Scheme, ComponentType<SchemeResultsProps>> = { EDGE: EdgeResults, CASA: CasaResults }

export function SchemeResults({ run, ...rest }: Omit<SchemeResultsProps, 'measures'>) {
  return run.schemes.map((scheme) => {
    const Results = RESULTS[scheme]
    return (
      <div key={scheme} className="flex flex-col" data-testid="scheme-results" data-scheme={scheme}>
        <h2 className="border-t bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground" data-testid="scheme-heading">
          {messages.schemes.heading(scheme, run.guides[scheme])}
        </h2>
        <Results run={run} measures={run.measures.filter((m) => schemeOf(m.code) === scheme)} {...rest} />
      </div>
    )
  })
}
