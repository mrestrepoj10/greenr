'use client'

import {
  CircleAlertIcon,
  InfoIcon,
  LoaderCircleIcon,
  MousePointer2Icon,
  SendIcon,
  SquareIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type {
  AgentNotice,
  AgentNoticeTone,
  AgentRuntimeStatus,
  AgentSelectionContext,
  AgentTurnStatus,
} from '@/lib/agent-types'
import { cn } from '@/lib/utils'

type AgentSendHandler = (
  text: string,
  options?: { includeSelection?: boolean },
) => void | Promise<void>

/** Thenable check, not `instanceof Promise`: a cross-realm promise is still pending work. */
function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('grid size-4 animate-spin place-items-center', className)}>
      <LoaderCircleIcon className="size-4" />
    </span>
  )
}

const noticeSurfaceClasses = {
  neutral: 'border-status-neutral bg-status-neutral-surface text-status-neutral',
  warning: 'border-status-warning bg-status-warning-surface text-status-warning',
  danger: 'border-status-danger bg-status-danger-surface text-status-danger',
} satisfies Record<AgentNoticeTone, string>

const noticeIcons = {
  neutral: InfoIcon,
  warning: TriangleAlertIcon,
  danger: CircleAlertIcon,
} satisfies Record<AgentNoticeTone, React.ComponentType<{ className?: string }>>

interface AgentNoticeViewProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  notice: AgentNotice
  /** One control under the description, such as a retry button. */
  action?: React.ReactNode
}

function AgentNoticeView({ notice, action, className, ...props }: AgentNoticeViewProps) {
  const Icon = noticeIcons[notice.tone]
  return (
    <div
      role="status"
      data-slot="agent-notice"
      data-tone={notice.tone}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border p-3',
        noticeSurfaceClasses[notice.tone],
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-medium text-sm leading-snug">{notice.title}</h3>
        {notice.description && <p className="text-xs leading-relaxed">{notice.description}</p>}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  )
}

const countFormatter = new Intl.NumberFormat()

interface AgentSelectionChipProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  selection: AgentSelectionContext
  /** Whether the next message carries the selection. */
  included?: boolean
  onIncludedChange?: (included: boolean) => void
}

function AgentSelectionChip({
  selection,
  included = false,
  onIncludedChange,
  className,
  ...props
}: AgentSelectionChipProps) {
  return (
    <div
      data-slot="agent-selection-chip"
      className={cn('flex min-h-9 items-center gap-2 text-sm', className)}
      {...props}
    >
      <MousePointer2Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-medium">
          {countFormatter.format(selection.dbIds.length)} selected
        </span>
        {selection.summary && <span className="text-muted-foreground"> · {selection.summary}</span>}
      </p>
      {onIncludedChange && (
        <Button
          type="button"
          variant={included ? 'default' : 'outline'}
          aria-pressed={included}
          className="h-9 shrink-0 px-2.5 text-xs"
          onClick={() => onIncludedChange(!included)}
        >
          Ask about selection
        </Button>
      )}
    </div>
  )
}

interface AgentComposerProps extends Omit<React.ComponentProps<'form'>, 'children' | 'onSubmit'> {
  turnStatus: AgentTurnStatus
  runtimeStatus?: AgentRuntimeStatus
  onSend: AgentSendHandler
  onCancel: () => void
  /** While a turn runs, submitting calls this instead of `onSend`. */
  onSteer?: (text: string) => void | Promise<void>
  /** Sent with the next message, then reset through `onIncludeSelectionChange`. */
  includeSelection?: boolean
  onIncludeSelectionChange?: (included: boolean) => void
  placeholder?: string
  /** Replaces the one-line hint under the field. */
  hint?: React.ReactNode
  textareaRef?: React.Ref<HTMLTextAreaElement>
}

function defaultHint(
  turnStatus: AgentTurnStatus,
  runtimeStatus: AgentRuntimeStatus,
  steerable: boolean,
): string {
  if (runtimeStatus === 'starting') return 'Starting the agent. You can type meanwhile.'
  if (turnStatus === 'cancelling') return 'Stopping the current turn.'
  if (turnStatus === 'running') {
    return steerable
      ? 'Enter adds your message to the running turn. Stop ends it.'
      : 'The agent is working. Stop ends the turn.'
  }
  return 'Enter to send, Shift+Enter for a new line. Viewer actions can be undone from their cards.'
}

function AgentComposer({
  turnStatus,
  runtimeStatus = 'ready',
  onSend,
  onCancel,
  onSteer,
  includeSelection = false,
  onIncludeSelectionChange,
  placeholder = 'Ask about the model, or tell the agent what to show…',
  hint,
  textareaRef,
  className,
  ...props
}: AgentComposerProps) {
  const hintId = useId()
  const fieldId = useId()
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)

  const turnActive = turnStatus !== 'idle'
  const busy = turnActive || sending || runtimeStatus === 'starting'
  const steerable = turnStatus === 'running' && Boolean(onSteer)
  const cancelling = turnStatus === 'cancelling'

  function submit(): void {
    const text = value.trim()
    if (!text) return
    if (steerable && onSteer) {
      setValue('')
      const result = onSteer(text)
      if (isPromiseLike(result)) result.then(undefined, () => setValue(text))
      return
    }
    if (busy) return
    setValue('')
    const result = onSend(text, includeSelection ? { includeSelection: true } : undefined)
    if (includeSelection) onIncludeSelectionChange?.(false)
    if (isPromiseLike(result)) {
      setSending(true)
      result.then(
        () => setSending(false),
        () => {
          setSending(false)
          setValue(text)
        },
      )
    }
  }

  return (
    <form
      data-slot="agent-composer"
      className={cn('flex flex-col gap-2', className)}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      {...props}
    >
      <div className="flex flex-col rounded-xl border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        <label htmlFor={fieldId} className="sr-only">
          Message the agent
        </label>
        <Textarea
          id={fieldId}
          ref={textareaRef}
          rows={2}
          value={value}
          placeholder={placeholder}
          aria-describedby={hintId}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
          className="max-h-48 min-h-11 resize-none rounded-xl border-0 bg-transparent px-3 pt-3 pb-1 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-end gap-2 p-1.5">
          {turnActive && (
            <Button
              type="button"
              variant="outline"
              aria-disabled={cancelling || undefined}
              className="h-11 gap-2 px-4 aria-disabled:pointer-events-none"
              onClick={() => {
                if (!cancelling) onCancel()
              }}
            >
              {cancelling ? <Spinner /> : <SquareIcon aria-hidden className="size-3.5" />}
              Stop
            </Button>
          )}
          <Button
            type="submit"
            aria-disabled={(busy && !steerable) || undefined}
            className="h-11 gap-2 px-4"
            onClick={(event) => {
              if (busy && !steerable) event.preventDefault()
            }}
          >
            Send
            {busy ? <Spinner /> : <SendIcon aria-hidden className="size-4" />}
          </Button>
        </div>
      </div>
      <p id={hintId} className="text-muted-foreground text-xs">
        {hint ?? defaultHint(turnStatus, runtimeStatus, steerable)}
      </p>
    </form>
  )
}

export {
  AgentComposer,
  type AgentComposerProps,
  AgentNoticeView,
  type AgentNoticeViewProps,
  AgentSelectionChip,
  type AgentSelectionChipProps,
  type AgentSendHandler,
}
