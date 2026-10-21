'use client'

import { ExternalLink } from 'lucide-react'
import { useId, useState } from 'react'
import { GuideLink } from '@/components/panel/measure-section'
import { CLIMATE_GEOVISOR_URL, RES_0194 } from '@/lib/edge/guide'
import {
  CLIMATE_ZONES,
  FLOOD_RETURN_YEARS,
  HOUSING_FORMS,
  MUNICIPALITY_CATEGORIES,
  TYPOLOGIES,
  type ProjectInputKey,
  type ProjectInputs,
} from '@/lib/edge/types'
import { messages } from '@/lib/ui/messages'

const CHOICES = {
  typology: TYPOLOGIES,
  housingForm: HOUSING_FORMS,
  municipalityCategory: MUNICIPALITY_CATEGORIES,
  climateZone: CLIMATE_ZONES,
  floodReturnYears: FLOOD_RETURN_YEARS,
  inFloodplain: [true, false],
} as const satisfies { [K in ProjectInputKey]?: readonly NonNullable<ProjectInputs[K]>[] }

type ChoiceKey = keyof typeof CHOICES
type NumberKey = 'roadGradeM' | 'floodElevationM' | 'datumOffsetM' | 'projectAreaM2'
type Field = { key: ChoiceKey; kind: 'choice' } | { key: NumberKey; kind: 'number' } | { key: 'municipality'; kind: 'text' }

const GROUPS: Field[][] = [
  [
    { key: 'typology', kind: 'choice' },
    { key: 'housingForm', kind: 'choice' },
    { key: 'municipality', kind: 'text' },
    { key: 'municipalityCategory', kind: 'choice' },
    { key: 'climateZone', kind: 'choice' },
    { key: 'projectAreaM2', kind: 'number' },
  ],
  [
    { key: 'roadGradeM', kind: 'number' },
    { key: 'floodElevationM', kind: 'number' },
    { key: 'floodReturnYears', kind: 'choice' },
    { key: 'inFloodplain', kind: 'choice' },
    { key: 'datumOffsetM', kind: 'number' },
  ],
]
const TOTAL = GROUPS.flat().length

const control =
  'h-7 w-full min-w-0 rounded-md border border-input bg-input/30 px-2 text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60'

type Update = (key: ProjectInputKey, value: ProjectInputs[ProjectInputKey] | undefined) => void

const optionLabel = (key: ChoiceKey, value: string) => (messages.projectInputs.options[key] as Record<string, string>)[value]

export interface ProjectInputsFormProps {
  inputs: ProjectInputs
  onChange?: (inputs: ProjectInputs) => void
}

/** What CASA and Res. 0194 need from the person, typed once per project. Selects save on change, text and numbers on blur or Enter. */
export function ProjectInputsForm({ inputs, onChange }: ProjectInputsFormProps) {
  const set = Object.keys(inputs).length
  const [open, setOpen] = useState(set === 0)

  const update: Update = (key, value) => {
    const next: Record<string, unknown> = { ...inputs }
    if (value === undefined) delete next[key]
    else next[key] = value
    onChange?.(next as ProjectInputs)
  }

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group border-t px-4 py-3"
      data-testid="project-inputs"
    >
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 text-sm font-medium">
        {messages.projectInputs.title}
        <span className="text-xs font-normal text-muted-foreground tabular-nums" data-testid="project-inputs-count">
          {messages.projectInputs.summary(set, TOTAL)}
        </span>
      </summary>
      <p className="pt-1 pb-3 text-xs text-muted-foreground">{messages.projectInputs.help}</p>
      <div className="flex flex-col gap-3">
        {GROUPS.map((fields, i) => (
          <div key={i} className="grid grid-cols-2 gap-x-3 gap-y-2">
            {fields.map((field) => (
              <InputField key={field.key} field={field} inputs={inputs} disabled={!onChange} update={update} />
            ))}
          </div>
        ))}
      </div>
    </details>
  )
}

function InputField({
  field,
  inputs,
  disabled,
  update,
}: {
  field: Field
  inputs: ProjectInputs
  disabled: boolean
  update: Update
}) {
  const id = useId()
  const { label, unit }: { label: string; unit?: string } = messages.projectInputs.fields[field.key]
  const value = inputs[field.key]
  return (
    <div className={field.key === 'climateZone' ? 'col-span-2 flex flex-col gap-1' : 'flex min-w-0 flex-col gap-1'}>
      <label htmlFor={id} className="truncate text-xs text-muted-foreground">
        {label}
        {unit ? <span className="ml-1">({unit})</span> : null}
      </label>
      {field.kind === 'choice' ? (
        <select
          id={id}
          className={control}
          disabled={disabled}
          value={value === undefined ? '' : String(value)}
          onChange={(event) => {
            const raw = event.target.value
            update(field.key, CHOICES[field.key].find((option) => String(option) === raw))
          }}
          data-testid={`project-input-${field.key}`}
        >
          <option value="">{messages.projectInputs.unset}</option>
          {CHOICES[field.key].map((option) => (
            <option key={String(option)} value={String(option)}>
              {optionLabel(field.key, String(option))}
            </option>
          ))}
        </select>
      ) : (
        <DraftInput
          key={String(value ?? '')}
          id={id}
          numeric={field.kind === 'number'}
          initial={value === undefined ? '' : String(value)}
          disabled={disabled}
          testId={`project-input-${field.key}`}
          commit={(raw) => {
            const value = field.kind === 'text' || raw === '' ? raw || undefined : Number(raw)
            if (typeof value === 'number' && !Number.isFinite(value)) return false
            update(field.key, value)
            return true
          }}
        />
      )}
      {field.key === 'climateZone' ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{messages.projectInputs.zoneHelp}</span>
          <a
            href={CLIMATE_GEOVISOR_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
            data-testid="climate-geovisor"
          >
            {messages.projectInputs.geovisor}
            <ExternalLink className="size-3" aria-hidden />
          </a>
          <GuideLink guide={RES_0194.climateZone} />
        </p>
      ) : null}
    </div>
  )
}

/** Keeps what the person types until they leave the field; an unparseable number goes back to the saved value. */
function DraftInput({
  id,
  numeric,
  initial,
  disabled,
  testId,
  commit,
}: {
  id: string
  numeric: boolean
  initial: string
  disabled: boolean
  testId: string
  commit: (raw: string) => boolean
}) {
  const [draft, setDraft] = useState(initial)
  const save = () => {
    const raw = draft.trim()
    if (raw === initial) return
    if (!commit(raw)) setDraft(initial)
  }
  return (
    <input
      id={id}
      type="text"
      inputMode={numeric ? 'decimal' : 'numeric'}
      className={control}
      disabled={disabled}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') save()
      }}
      data-testid={testId}
    />
  )
}
