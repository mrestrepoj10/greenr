'use client'

import {
  CheckIcon,
  CircleSlashIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  Undo2Icon,
  XIcon,
} from 'lucide-react'
import Image from 'next/image'
import type * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type StatusTone, statusInkClasses, statusToneClasses } from '@/components/ui/token-status'
import type { AgentAction, AgentActionStatus, AgentImage, ElementSet } from '@/lib/agent-types'
import { cn } from '@/lib/utils'

const actionTone = {
  running: 'neutral',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  partial: 'warning',
} satisfies Record<AgentActionStatus, StatusTone>

const actionStatusLabel = {
  running: 'Running',
  succeeded: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
  partial: 'Partial',
} satisfies Record<AgentActionStatus, string>

function agentImageSrc(image: AgentImage): string {
  return `data:${image.mimeType};base64,${image.base64}`
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'undefined'
  } catch {
    return String(value)
  }
}

function ActionStatusIcon({ status }: { status: AgentActionStatus }) {
  const ink = statusInkClasses[actionTone[status]]
  switch (status) {
    case 'running':
      return (
        <span className={cn('grid size-3.5 animate-spin place-items-center', ink)}>
          <LoaderCircleIcon className="size-3.5" />
        </span>
      )
    case 'succeeded':
      return <CheckIcon className={cn('size-3.5', ink)} />
    case 'failed':
      return <XIcon className={cn('size-3.5', ink)} />
    case 'cancelled':
      return <CircleSlashIcon className={cn('size-3.5', ink)} />
    case 'partial':
      return <TriangleAlertIcon className={cn('size-3.5', ink)} />
  }
}

interface AgentActionCardProps extends Omit<React.ComponentProps<'li'>, 'children'> {
  action: AgentAction
  /** The set named by `action.setId`, when the consumer still has it. */
  set?: ElementSet
  showDetails?: boolean
  onUndo?: (action: AgentAction) => void
  onSelectSet?: (set: ElementSet) => void
}

function AgentActionCard({
  action,
  set,
  showDetails = false,
  onUndo,
  onSelectSet,
  className,
  ...props
}: AgentActionCardProps) {
  const tone = actionTone[action.status]
  const canUndo = Boolean(onUndo && action.undoable && action.undoId)
  const canSelect = Boolean(set && onSelectSet)
  const flagged =
    action.status === 'failed' || action.status === 'cancelled' || action.status === 'partial'

  return (
    <li
      data-slot="agent-action-card"
      data-status={action.status}
      className={cn('flex flex-col gap-2 rounded-lg border border-border bg-card p-2', className)}
      {...props}
    >
      <div className="flex items-start gap-2.5">
        {action.image ? (
          <Image
            src={agentImageSrc(action.image)}
            unoptimized
            alt={action.label}
            width={action.image.width ?? 56}
            height={action.image.height ?? 36}
            className="h-9 w-14 shrink-0 rounded-sm border border-border bg-muted object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background"
          >
            <ActionStatusIcon status={action.status} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-medium text-sm leading-snug">
            <span className="min-w-0 break-words">{action.label}</span>
            {action.color && (
              <span className="inline-flex items-center gap-1 font-mono font-normal text-xs">
                <span
                  aria-hidden
                  className="size-2.5 rounded-xs border border-border"
                  style={{ backgroundColor: action.color }}
                />
                {action.color}
              </span>
            )}
            {flagged ? (
              <Badge className={cn('h-5 px-1.5 text-xs', statusToneClasses[tone])}>
                {actionStatusLabel[action.status]}
              </Badge>
            ) : (
              <span className="sr-only">{actionStatusLabel[action.status]}</span>
            )}
          </p>
          {action.detail && (
            <p className="break-words text-muted-foreground text-xs">{action.detail}</p>
          )}
          {action.status === 'failed' && action.error && (
            <p className={cn('break-words text-xs', statusInkClasses.danger)}>{action.error}</p>
          )}
        </div>
        {canSelect || canUndo ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {set && onSelectSet && (
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-2.5 text-xs"
                aria-label={`Select ${set.id}`}
                onClick={() => onSelectSet(set)}
              >
                Select
              </Button>
            )}
            {canUndo && (
              <Button
                type="button"
                variant="ghost"
                className="h-9 gap-1.5 px-2.5 text-xs"
                aria-label={`Undo ${action.label}`}
                onClick={() => onUndo?.(action)}
              >
                <Undo2Icon aria-hidden className="size-3.5" />
                Undo
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {showDetails && (
        <pre
          data-slot="agent-action-details"
          className="max-h-60 overflow-auto rounded-md bg-muted p-2 font-mono text-xs leading-relaxed"
        >
          {formatJson({
            tool: action.tool,
            input: action.input,
            output: action.output,
            error: action.error,
          })}
        </pre>
      )}
    </li>
  )
}

export { AgentActionCard, type AgentActionCardProps, agentImageSrc }
