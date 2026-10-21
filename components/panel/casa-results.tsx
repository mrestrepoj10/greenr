'use client'

import { Waves } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { CompassRose } from '@/components/panel/compass-rose'
import { DesignInputs } from '@/components/panel/design-inputs'
import { GapsList } from '@/components/panel/gaps-list'
import { MeasureSection } from '@/components/panel/measure-section'
import { ProjectInputFields } from '@/components/panel/project-inputs'
import { WwrTable } from '@/components/panel/wwr-table'
import { Button } from '@/components/ui/button'
import { NTC_1500, type FixtureKind } from '@/lib/edge/casa/ntc1500'
import { CREDIT_GUIDES } from '@/lib/edge/guide'
import { MEASURES } from '@/lib/edge/measures'
import { C_ENV_TYPES } from '@/lib/edge/measures/casa/c-env'
import { C_VENT_ROWS } from '@/lib/edge/measures/casa/c-vent'
import { FIXTURE_ROWS } from '@/lib/edge/measures/casa/c-water'
import type { LabelFamily } from '@/lib/edge/measures/labels'
import {
  MEASURE_CODES,
  isCodeOf,
  type DwellingSummary,
  type InputValue,
  type MeasureBlocker,
  type MeasureCodeOf,
  type MeasureResult,
  type ProjectInputKey,
  type ProjectInputs,
  type RunResult,
} from '@/lib/edge/types'
import { formatRatio, formatValue } from '@/lib/ui/format'
import { blockerText, messages } from '@/lib/ui/messages'
import { cn } from '@/lib/utils'

type CasaCode = MeasureCodeOf<'CASA'>

export type FloodPlaneToggle = { on: boolean; onChange: (on: boolean) => void; available: boolean }

export interface CasaResultsProps {
  run: RunResult
  measures: MeasureResult[]
  selectedKey: string | null
  onSelect: (key: string, dbIds: number[]) => void
  onNorthChange?: (angleDeg: number) => void
  /** The project's inputs, for the fields a blocked measure asks for inline. */
  inputs?: ProjectInputs
  onInputsChange?: (inputs: ProjectInputs) => void
  floodPlane?: FloodPlaneToggle
}

type BodyProps = Omit<CasaResultsProps, 'measures'> & { m: MeasureResult }

const C = messages.casa

function DwellingsLine({ dwellings }: { dwellings: DwellingSummary | undefined }) {
  if (!dwellings) return null
  return (
    <div className="flex flex-col gap-1.5 px-4 pt-3 pb-1 text-xs text-muted-foreground" data-testid="dwellings" data-count={dwellings.count} data-rule={dwellings.source ?? ''}>
      <p>
        <span className="font-medium text-foreground">{C.dwellings.title}. </span>
        {dwellings.source ? C.dwellings.line(dwellings.count, C.dwellings.rules[dwellings.source]) : C.dwellings.none}
      </p>
      {dwellings.bedrooms.length ? (
        <ul className="flex flex-wrap items-center gap-1" aria-label={C.dwellings.bedrooms} data-testid="bedrooms">
          <li className="pr-1">{C.dwellings.bedrooms}</li>
          {dwellings.bedrooms.map((b) => (
            <li key={b.bedrooms} className="rounded-sm border px-1.5 py-px tabular-nums" data-bedrooms={b.bedrooms} data-units={b.units}>
              {C.dwellings.bucket(b.bedrooms, b.units)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** A blocked measure is waiting on something, not failing: dashed and muted, never the error colour. */
function BlockedNote({ blockers }: { blockers: MeasureBlocker[] | undefined }) {
  if (!blockers?.length) return null
  return (
    <ul className="flex flex-col gap-1 rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground" data-testid="measure-blocked">
      {blockers.map((blocker) => (
        <li key={JSON.stringify(blocker)} data-kind={blocker.kind}>
          {blockerText(blocker)}
        </li>
      ))}
    </ul>
  )
}

/** The credits a table serves, each with the page that sets its number. */
function Citations({ credits }: { credits: readonly string[] }) {
  const cited = credits.flatMap((credit) => (CREDIT_GUIDES[credit] ? [[credit, CREDIT_GUIDES[credit]] as const] : []))
  if (!cited.length) return null
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground" data-testid="citations">
      {cited.map(([credit, guide]) => (
        <a key={credit} href={guide.url} target="_blank" rel="noreferrer" title={guide.title} className="underline-offset-4 hover:text-foreground hover:underline">
          {C.cite(credit, messages.creditNames[credit as keyof typeof messages.creditNames], guide.page)}
        </a>
      ))}
    </p>
  )
}

function Row({
  selected,
  onClick,
  children,
  testId,
  className,
}: {
  selected: boolean
  onClick?: () => void
  children: ReactNode
  testId: string
  className?: string
}) {
  return (
    <tr
      data-testid={testId}
      aria-selected={selected}
      onClick={onClick}
      className={cn('h-7 border-t border-border/60', onClick && 'cursor-pointer hover:bg-accent/60', selected && 'bg-accent', className)}
    >
      {children}
    </tr>
  )
}

const named = (inputs: InputValue[], family: LabelFamily) =>
  inputs.flatMap((input) => {
    const name = family.nameOf(input.label)
    return name === null ? [] : [{ name, input }]
  })

const scroll = 'max-h-64 overflow-y-auto'

function TypeTable({ title, rows, kind, selectedKey, onSelect }: { title: string; rows: { name: string; input: InputValue }[]; kind: string } & Pick<BodyProps, 'selectedKey' | 'onSelect'>) {
  if (!rows.length) return null
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs text-muted-foreground">{title}</h3>
      <div className={scroll}>
        <table className="w-full text-xs" data-testid="casa-types" data-kind={kind}>
          <tbody className="tabular-nums">
            {rows.map(({ name, input }) => {
              const key = `casa-type:${input.label}`
              return (
                <Row key={key} testId="casa-type-row" selected={selectedKey === key} onClick={() => onSelect(key, input.dbIds ?? [])}>
                  <th scope="row" className="max-w-0 truncate pr-2 text-left font-normal" title={name}>
                    {name}
                  </th>
                  <td className="text-right whitespace-nowrap text-muted-foreground">
                    {input.value === null ? C.types.noValue : `${formatValue(input.value)}${typeof input.value === 'number' ? ` ${input.unit}` : ''}`}
                  </td>
                  <td className="w-10 text-right text-muted-foreground">{input.dbIds?.length ?? 0}</td>
                </Row>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const TYPE_FAMILIES = [C_ENV_TYPES.glazing, C_ENV_TYPES.wall, C_ENV_TYPES.roof]
const isTypeRow = (label: string) => TYPE_FAMILIES.some((f) => f.nameOf(label) !== null)

function EnvelopeBody({ run, m, selectedKey, onSelect, onNorthChange }: BodyProps) {
  return (
    <>
      {m.orientations ? (
        <WwrTable name="facade" rows={m.orientations} selectedKey={selectedKey} onSelect={onSelect} />
      ) : (
        <table className="w-full text-sm" data-testid="facade-table" data-blocked="true">
          <tbody>
            {(['N', 'E', 'S', 'W'] as const).map((o) => (
              <tr key={o} data-testid="facade-row" data-orientation={o} className="h-8 border-t border-dashed border-border/60 text-muted-foreground/70">
                <th scope="row" className="w-10 text-left font-medium">
                  {o}
                </th>
                <td colSpan={3} className="text-right text-xs">
                  {C.facade.blocked}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <CompassRose north={run.snapshot.north} onNorthChange={onNorthChange} quadrants />
      <p className="text-xs text-muted-foreground">{C.facade.sectors}</p>
      <Citations credits={MEASURES['C-ENV'].credits} />
      <DesignInputs measures={[{ ...m, inputs: m.inputs.filter((i) => !isTypeRow(i.label)) }]} selectedKey={selectedKey} onSelect={onSelect} />
      <TypeTable title={C.types.glazing} kind="glazing" rows={named(m.inputs, C_ENV_TYPES.glazing)} selectedKey={selectedKey} onSelect={onSelect} />
      <TypeTable title={C.types.wall} kind="wall" rows={named(m.inputs, C_ENV_TYPES.wall)} selectedKey={selectedKey} onSelect={onSelect} />
      <TypeTable title={C.types.roof} kind="roof" rows={named(m.inputs, C_ENV_TYPES.roof)} selectedKey={selectedKey} onSelect={onSelect} />
    </>
  )
}

const FLOOD_FIELDS: readonly ProjectInputKey[] = ['roadGradeM', 'floodElevationM', 'floodReturnYears', 'datumOffsetM']

function FloodBody({ m, inputs = {}, onInputsChange, selectedKey, onSelect }: BodyProps) {
  const missing = FLOOD_FIELDS.filter((key) => inputs[key] === undefined)
  return (
    <>
      {missing.length ? (
        <div className="flex flex-col gap-2" data-testid="flood-inputs">
          <p className="text-xs text-muted-foreground">{C.flood.needs}</p>
          <ProjectInputFields keys={missing} inputs={inputs} onChange={onInputsChange} />
        </div>
      ) : null}
      <dl className="flex flex-col divide-y text-sm" data-testid="flood-counts">
        {m.inputs.map((input) => {
          const key = `flood:${input.label}`
          const ids = input.dbIds ?? []
          return (
            <div key={key} className={cn('-mx-2 grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-md px-2 py-1.5', selectedKey === key && 'bg-accent')} data-testid="flood-count" data-label={input.label} data-value={input.value ?? ''}>
              <dt className="text-xs">{input.label}</dt>
              <dd className="text-right tabular-nums">
                {formatValue(input.value)}
                <span className="ml-1 text-muted-foreground">{input.unit}</span>
              </dd>
              {ids.length > 0 && input.unit !== 'm' ? (
                <dd className="col-span-2">
                  <Button size="xs" variant="ghost" className="-ml-2 text-muted-foreground" onClick={() => onSelect(key, ids)} data-testid="flood-show">
                    {C.flood.show}
                  </Button>
                </dd>
              ) : null}
            </div>
          )
        })}
      </dl>
      <Citations credits={MEASURES['C-FLOOD'].credits} />
    </>
  )
}

function FloodAside({ inputs, floodPlane }: Pick<BodyProps, 'inputs' | 'floodPlane'>) {
  if (!floodPlane || inputs?.floodElevationM === undefined) return null
  return (
    <Button
      size="xs"
      variant={floodPlane.on ? 'secondary' : 'ghost'}
      aria-pressed={floodPlane.on}
      onClick={() => floodPlane.onChange(!floodPlane.on)}
      disabled={!floodPlane.available}
      title={C.flood.plane(inputs.floodElevationM.toFixed(2))}
      data-testid="toggle-flood-plane"
    >
      <Waves data-icon="inline-start" aria-hidden />
      {floodPlane.on ? C.flood.hidePlane : C.flood.showPlane}
    </Button>
  )
}

function ShareTable({ title, label, rows, testId, credit, selectedKey, onSelect }: { title: string; label: string; rows: { name: string; input: InputValue }[]; testId: string; credit: string } & Pick<BodyProps, 'selectedKey' | 'onSelect'>) {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => (a.input.value === null ? 1 : b.input.value === null ? -1 : Number(a.input.value) - Number(b.input.value)))
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs text-muted-foreground">{title}</h3>
      <div className={scroll}>
        <table className="w-full text-xs" data-testid={`${testId}-table`}>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 text-left font-normal">
                {label}
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                {C.vent.share}
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {sorted.map(({ name, input }) => {
              const key = `${testId}:${input.label}`
              return (
                <Row key={key} testId={`${testId}-row`} selected={selectedKey === key} onClick={input.dbIds?.length ? () => onSelect(key, input.dbIds ?? []) : undefined}>
                  <th scope="row" className="text-left font-normal" data-name={name}>
                    {name}
                  </th>
                  <td className="text-right" data-value={input.value ?? ''}>
                    {typeof input.value === 'number' ? formatRatio(input.value) : C.vent.noFloor}
                  </td>
                </Row>
              )
            })}
          </tbody>
        </table>
      </div>
      <Citations credits={[credit]} />
    </div>
  )
}

const isShareRow = (label: string) => C_VENT_ROWS.unit.nameOf(label) !== null || C_VENT_ROWS.room.nameOf(label) !== null

function VentBody({ m, selectedKey, onSelect }: BodyProps) {
  return (
    <>
      <DesignInputs measures={[{ ...m, inputs: m.inputs.filter((i) => !isShareRow(i.label)) }]} selectedKey={selectedKey} onSelect={onSelect} />
      <ShareTable title={C.vent.units} label={C.vent.unit} rows={named(m.inputs, C_VENT_ROWS.unit)} testId="vent-unit" credit="SBc6" selectedKey={selectedKey} onSelect={onSelect} />
      <ShareTable title={C.vent.rooms} label={C.vent.room} rows={named(m.inputs, C_VENT_ROWS.room)} testId="vent-room" credit="SBp1" selectedKey={selectedKey} onSelect={onSelect} />
    </>
  )
}

type FixtureRow = { typeKey: string; kind: FixtureKind | null; value: InputValue['value']; dbIds: number[] }

function fixtureRows(m: MeasureResult): FixtureRow[] {
  const ntc = Object.entries(FIXTURE_ROWS).flatMap(([kind, family]) =>
    named(m.inputs, family).map(({ name, input }) => ({ typeKey: name, kind: kind as FixtureKind, value: input.value, dbIds: input.dbIds ?? [] })),
  )
  const other = m.gaps.filter((g) => g.missing === 'Fixture kind').map((g) => ({ typeKey: g.typeKey, kind: null, value: null, dbIds: g.dbIds }))
  return [...ntc, ...other]
}

const isFixtureRow = (label: string) => Object.values(FIXTURE_ROWS).some((f) => f.nameOf(label) !== null)

function WaterBody({ m, selectedKey, onSelect }: BodyProps) {
  const rows = fixtureRows(m)
  return (
    <>
      {rows.length ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs text-muted-foreground">{C.water.title}</h3>
          <div className={scroll}>
            <table className="w-full text-xs" data-testid="water-table">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="py-1 text-left font-normal">
                    {C.water.fixture}
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    {C.water.cap}
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    {C.water.model}
                  </th>
                  <th scope="col" className="w-10" />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((row) => {
                  const key = `water:${row.typeKey}`
                  const cap = row.kind ? NTC_1500[row.kind] : null
                  return (
                    <Row key={key} testId="water-row" selected={selectedKey === key} onClick={() => onSelect(key, row.dbIds)}>
                      <th scope="row" className="max-w-0 truncate pr-2 text-left font-normal" title={row.typeKey} data-kind={row.kind ?? ''}>
                        {cap ? `${cap.label} · ` : ''}
                        <span className="text-muted-foreground">{row.typeKey}</span>
                      </th>
                      <td className="text-right whitespace-nowrap">{cap ? `${cap.cap} ${cap.unit}` : ''}</td>
                      <td className="text-right whitespace-nowrap text-muted-foreground" data-testid="water-value">
                        {!cap ? C.water.notNtc : row.value === null ? C.water.noParameter(cap.unit) : `${formatValue(row.value)} ${cap.unit}`}
                      </td>
                      <td className="text-right text-muted-foreground">{row.dbIds.length}</td>
                    </Row>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Citations credits={['Ap3']} />
        </div>
      ) : null}
      <DesignInputs measures={[{ ...m, inputs: m.inputs.filter((i) => !isFixtureRow(i.label)) }]} selectedKey={selectedKey} onSelect={onSelect} />
    </>
  )
}

function ValuesBody({ m, selectedKey, onSelect }: BodyProps) {
  return (
    <>
      <DesignInputs measures={[m]} selectedKey={selectedKey} onSelect={onSelect} />
      <Citations credits={MEASURES[m.code].credits} />
    </>
  )
}

/** The bodies with their own table; C-FLEX, C-SRI and C-GLAZE are read as their values and gaps. */
const BODIES: Record<CasaCode, ComponentType<BodyProps>> = {
  'C-ENV': EnvelopeBody,
  'C-FLOOD': FloodBody,
  'C-VENT': VentBody,
  'C-WATER': WaterBody,
  'C-FLEX': ValuesBody,
  'C-SRI': ValuesBody,
  'C-GLAZE': ValuesBody,
}

const GAPS_OPEN: ReadonlySet<CasaCode> = new Set(['C-FLEX', 'C-SRI', 'C-GLAZE'])
const GAP_ROWS = 6

function MeasureGaps({ m, selectedKey, onSelect }: BodyProps) {
  if (!m.gaps.length) return null
  const list = <GapsList scheme="CASA" measures={[m]} selectedKey={selectedKey} onSelect={onSelect} limit={GAP_ROWS} />
  if (isCodeOf('CASA', m.code) && GAPS_OPEN.has(m.code)) return list
  return (
    <details className="group text-sm" data-testid="measure-gaps">
      <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground">{C.gaps(m.gaps.length)}</summary>
      {list}
    </details>
  )
}

export function CasaResults({ measures, ...rest }: CasaResultsProps) {
  const byCode = new Map(measures.map((m) => [m.code, m]))
  return (
    <>
      <DwellingsLine dwellings={rest.run.dwellings} />
      {MEASURE_CODES.CASA.map((code) => {
        const m = byCode.get(code)
        if (!m) return null
        const Body = BODIES[code]
        return (
          <MeasureSection
            key={code}
            title={C.titles[code]}
            guide={m.guide}
            credits={MEASURES[code].credits}
            testId="casa-measure"
            code={code}
            state={m.state}
            aside={code === 'C-FLOOD' ? <FloodAside inputs={rest.inputs} floodPlane={rest.floodPlane} /> : null}
          >
            <BlockedNote blockers={m.blockedBy} />
            <Body {...rest} m={m} />
            <MeasureGaps {...rest} m={m} />
          </MeasureSection>
        )
      })}
    </>
  )
}
