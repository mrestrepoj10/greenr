'use client'

import { GuideLink } from '@/components/panel/measure-section'
import { cn } from '@/lib/utils'
import type { MeasureResult } from '@/lib/edge/types'
import { formatValue } from '@/lib/ui/format'
import { messages } from '@/lib/ui/messages'

export interface DesignInputsProps {
  measures: MeasureResult[]
  selectedKey: string | null
  onSelect: (key: string, dbIds: number[]) => void
}

export function DesignInputs({ measures, selectedKey, onSelect }: DesignInputsProps) {
  return (
    <dl className="flex flex-col divide-y text-sm" data-testid="design-inputs">
      {measures.flatMap((measure) =>
        measure.inputs.map((input, i) => {
          const key = `input:${measure.code}:${i}`
          const clickable = (input.dbIds?.length ?? 0) > 0
          return (
            <div
              key={key}
              data-testid="design-input"
              data-code={measure.code}
              aria-selected={selectedKey === key}
              onClick={clickable ? () => onSelect(key, input.dbIds ?? []) : undefined}
              className={cn(
                '-mx-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded-md px-2 py-2',
                clickable && 'cursor-pointer hover:bg-accent/60',
                selectedKey === key && 'bg-accent',
              )}
            >
              <dt className="truncate">{input.label}</dt>
              <dd className="text-right tabular-nums">
                {formatValue(input.value)}
                <span className="ml-1 text-muted-foreground">{input.unit}</span>
              </dd>
              <dd className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{measure.code}</span>
                <GuideLink guide={measure.guide} />
                <span className="ml-auto rounded-sm border border-border px-1.5 py-px text-[11px]">{messages.sources[input.source]}</span>
              </dd>
            </div>
          )
        }),
      )}
    </dl>
  )
}
