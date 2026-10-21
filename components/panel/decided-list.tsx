'use client'

import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Classification, Exclusion } from '@/lib/edge/types'
import { messages } from '@/lib/ui/messages'

export interface DecidedListProps {
  exclusions: Exclusion[]
  types: Classification[]
  selectedKey: string | null
  onSelect: (key: string, dbIds: number[]) => void
  elementsOf: (typeKey: string) => number[]
  onUndoExclusion?: (id: string) => void
  onUnconfirmType?: (typeKey: string) => void
}

/** Every accepted or rejected exclusion and every type the person confirmed, each with an Undo. Collapsed by default. */
export function DecidedList({ exclusions, types, selectedKey, onSelect, elementsOf, onUndoExclusion, onUnconfirmType }: DecidedListProps) {
  const count = exclusions.length + types.length
  if (count === 0) return null
  return (
    <details className="group/decided -mx-2 rounded-md" data-testid="decided">
      <summary className="flex cursor-pointer list-none items-baseline justify-between rounded-sm px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronRight className="size-3 transition-transform group-open/decided:rotate-90" aria-hidden />
          {messages.decided.title}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums" data-testid="decided-count">
          {count}
        </span>
      </summary>
      <ul className="flex flex-col divide-y px-2">
        {exclusions.map((e) => (
          <DecidedRow
            key={`excl:${e.id}`}
            testId="decided-exclusion"
            data={{ 'data-exclusion-id': e.id, 'data-status': e.status }}
            title={messages.exclusionReasons[e.reason]}
            note={e.note}
            detail={`${messages.decided.status[e.status]} · ${messages.elements(e.dbIds.length)}`}
            selected={selectedKey === `excl:${e.id}`}
            onSelect={() => onSelect(`excl:${e.id}`, e.dbIds)}
            onUndo={onUndoExclusion ? () => onUndoExclusion(e.id) : undefined}
          />
        ))}
        {types.map((c) => (
          <DecidedRow
            key={`type:${c.typeKey}`}
            testId="decided-type"
            data={{ 'data-type-key': c.typeKey }}
            title={c.typeKey}
            detail={messages.decided.confirmedAs(messages.roles[c.role])}
            selected={selectedKey === `type:${c.typeKey}`}
            onSelect={() => onSelect(`type:${c.typeKey}`, elementsOf(c.typeKey))}
            onUndo={onUnconfirmType ? () => onUnconfirmType(c.typeKey) : undefined}
          />
        ))}
      </ul>
    </details>
  )
}

function DecidedRow({
  testId,
  data,
  title,
  note,
  detail,
  selected,
  onSelect,
  onUndo,
}: {
  testId: string
  data: Record<`data-${string}`, string>
  title: string
  note?: string
  detail: string
  selected: boolean
  onSelect: () => void
  onUndo?: () => void
}) {
  return (
    <li className={cn('-mx-2 flex items-center gap-2 rounded-md px-2 py-2', selected && 'bg-accent')} data-testid={testId} {...data}>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="truncate text-sm" title={title}>
          {title}
        </span>
        {note ? (
          <span className="truncate text-xs text-muted-foreground" title={note}>
            {note}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground tabular-nums">{detail}</span>
      </button>
      <Button size="xs" variant="ghost" disabled={!onUndo} onClick={onUndo} data-testid="undo-decision">
        {messages.decided.undo}
      </Button>
    </li>
  )
}
