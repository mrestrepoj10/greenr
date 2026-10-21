'use client'

import { DecidedList } from '@/components/panel/decided-list'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type Classification, ELEMENT_ROLES, type ElementRole, type Exclusion, type ExclusionStatus } from '@/lib/edge/types'
import type { Decisions } from '@/lib/run/pipeline'
import { formatRatio } from '@/lib/ui/format'
import { messages } from '@/lib/ui/messages'

export interface ConfirmationBlockProps {
  pending: Classification[]
  exclusions: Exclusion[]
  /** Listed under Decided, each with an Undo. */
  decided: Decisions
  selectedKey: string | null
  onSelect: (key: string, dbIds: number[]) => void
  elementsOf: (typeKey: string) => number[]
  onConfirmType?: (typeKey: string, role: ElementRole) => void
  onUnconfirmType?: (typeKey: string) => void
  onDecideExclusion?: (id: string, status: ExclusionStatus) => void
}

export function ConfirmationBlock({
  pending,
  exclusions,
  decided,
  selectedKey,
  onSelect,
  elementsOf,
  onConfirmType,
  onUnconfirmType,
  onDecideExclusion,
}: ConfirmationBlockProps) {
  const open = exclusions.filter((e) => e.status === 'proposed')
  const empty = pending.length === 0 && open.length === 0
  return (
    <section className="flex flex-col gap-3 border-t px-4 py-4" data-testid="confirmation-block">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">{messages.needsConfirmation}</h2>
        {!empty ? (
          <span className="text-xs text-muted-foreground tabular-nums" data-testid="pending-count">
            {pending.length + open.length}
          </span>
        ) : null}
      </header>
      {empty ? <p className="text-sm text-muted-foreground">{messages.nothingPending}</p> : null}
      {pending.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs text-muted-foreground">{messages.pendingTypes}</h3>
          <ul className="flex flex-col divide-y">
            {pending.map((c) => (
              <PendingTypeRow
                key={c.typeKey}
                classification={c}
                selected={selectedKey === `type:${c.typeKey}`}
                onSelect={() => onSelect(`type:${c.typeKey}`, elementsOf(c.typeKey))}
                onConfirm={onConfirmType ? (role) => onConfirmType(c.typeKey, role) : undefined}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {open.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs text-muted-foreground">{messages.proposedExclusions}</h3>
          <ul className="flex flex-col divide-y">
            {open.map((e) => (
              <ExclusionRow
                key={e.id}
                exclusion={e}
                selected={selectedKey === `excl:${e.id}`}
                onSelect={() => onSelect(`excl:${e.id}`, e.dbIds)}
                onDecide={onDecideExclusion ? (status) => onDecideExclusion(e.id, status) : undefined}
              />
            ))}
          </ul>
        </div>
      ) : null}
      <DecidedList
        exclusions={decided.exclusions}
        types={decided.types}
        selectedKey={selectedKey}
        onSelect={onSelect}
        elementsOf={elementsOf}
        onUndoExclusion={onDecideExclusion ? (id) => onDecideExclusion(id, 'proposed') : undefined}
        onUnconfirmType={onUnconfirmType}
      />
    </section>
  )
}

function PendingTypeRow({
  classification: c,
  selected,
  onSelect,
  onConfirm,
}: {
  classification: Classification
  selected: boolean
  onSelect: () => void
  onConfirm?: (role: ElementRole) => void
}) {
  return (
    <li
      className={cn('-mx-2 flex flex-col gap-2 rounded-md px-2 py-2.5', selected && 'bg-accent')}
      data-testid="pending-type"
      data-type-key={c.typeKey}
    >
      <button type="button" onClick={onSelect} className="flex flex-col gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm">
        <span className="truncate text-sm" title={c.typeKey}>
          {c.typeKey}
        </span>
        <span className="text-xs text-muted-foreground">{c.reason}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-0.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full bg-foreground/70" style={{ width: `${Math.round(c.confidence * 100)}%` }} />
          </span>
          <span className="tabular-nums">
            {formatRatio(c.confidence)} {messages.confidence}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="sr-only">{messages.changeRole}</span>
          <select
            value={c.role}
            onChange={(event) => onConfirm?.(event.target.value as ElementRole)}
            disabled={!onConfirm}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-input/30 px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            data-testid="role-select"
          >
            {ELEMENT_ROLES.map((role) => (
              <option key={role} value={role}>
                {messages.roles[role]}
              </option>
            ))}
          </select>
        </label>
        <Button size="xs" variant="secondary" disabled={!onConfirm} onClick={() => onConfirm?.(c.role)} data-testid="confirm-type">
          {messages.confirm}
        </Button>
      </div>
    </li>
  )
}

function ExclusionRow({
  exclusion: e,
  selected,
  onSelect,
  onDecide,
}: {
  exclusion: Exclusion
  selected: boolean
  onSelect: () => void
  onDecide?: (status: ExclusionStatus) => void
}) {
  return (
    <li
      className={cn('-mx-2 flex flex-col gap-2 rounded-md px-2 py-2.5', selected && 'bg-accent')}
      data-testid="proposed-exclusion"
      data-exclusion-id={e.id}
    >
      <button type="button" onClick={onSelect} className="flex flex-col gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm">
        <span className="flex items-baseline gap-2 text-sm">
          {messages.exclusionReasons[e.reason]}
          <span className="text-xs text-muted-foreground tabular-nums">{messages.elements(e.dbIds.length)}</span>
        </span>
        {e.note ? <span className="text-xs text-muted-foreground">{e.note}</span> : null}
      </button>
      <div className="flex items-center gap-2">
        <Button size="xs" variant="secondary" disabled={!onDecide} onClick={() => onDecide?.('accepted')} data-testid="accept-exclusion">
          {messages.accept}
        </Button>
        <Button size="xs" variant="ghost" disabled={!onDecide} onClick={() => onDecide?.('rejected')} data-testid="reject-exclusion">
          {messages.reject}
        </Button>
      </div>
    </li>
  )
}
