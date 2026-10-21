'use client'

import { useState } from 'react'
import { GuideLink } from '@/components/panel/measure-section'
import { cn } from '@/lib/utils'
import type { Gap, MeasureResult, Scheme } from '@/lib/edge/types'
import { messages } from '@/lib/ui/messages'

const SEVERITY_DOT: Record<Gap['severity'], string> = {
  'blocks-claim': 'bg-gap-blocks',
  'needs-data-sheet': 'bg-gap-data',
  info: 'bg-gap-info',
}

export interface GapsListProps {
  scheme: Scheme
  measures: MeasureResult[]
  selectedKey: string | null
  onSelect: (key: string, dbIds: number[]) => void
  /** Rows shown before a "show more" button. */
  limit?: number
}

export function GapsList({ scheme, measures, selectedKey, onSelect, limit = Infinity }: GapsListProps) {
  const [all, setAll] = useState(false)
  const gaps = measures.flatMap((m) => m.gaps.map((gap) => ({ gap, guide: m.guide })))
  if (gaps.length === 0) return <p className="text-sm text-muted-foreground">{messages.gaps.none(scheme)}</p>
  const shown = all ? gaps : gaps.slice(0, limit)
  return (
    <ul className="flex flex-col divide-y" data-testid="gaps-list">
      {shown.map(({ gap, guide }) => {
        const key = `gap:${gap.id}`
        return (
          <li key={gap.id}>
            <button
              type="button"
              data-testid="gap-row"
              data-gap-id={gap.id}
              aria-pressed={selectedKey === key}
              onClick={() => onSelect(key, gap.dbIds)}
              className={cn(
                '-mx-2 flex w-[calc(100%+1rem)] items-start gap-2.5 rounded-md px-2 py-2.5 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50',
                selectedKey === key && 'bg-accent',
              )}
            >
              <span
                className={cn('mt-1.5 size-2 shrink-0 rounded-full', SEVERITY_DOT[gap.severity])}
                title={messages.gaps.severity[gap.severity]}
                aria-label={messages.gaps.severity[gap.severity]}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline gap-2 text-sm">
                  <span className="font-mono text-xs">{gap.measure}</span>
                  <span>{messages.gaps.missing(gap.missing)}</span>
                </span>
                <span className="truncate text-xs text-muted-foreground" title={gap.typeKey}>
                  {gap.typeKey}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{messages.elements(gap.dbIds.length)}</span>
                  <GuideLink guide={guide} />
                </span>
              </span>
            </button>
          </li>
        )
      })}
      {shown.length < gaps.length ? (
        <li>
          <button type="button" onClick={() => setAll(true)} className="py-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {messages.casa.more(gaps.length - shown.length)}
          </button>
        </li>
      ) : null}
    </ul>
  )
}
