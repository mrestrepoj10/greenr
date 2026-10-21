'use client'

import { PlusIcon, XIcon } from 'lucide-react'
import type * as React from 'react'
import { useCallback, useId, useRef, useState, useSyncExternalStore } from 'react'

import {
  AgentComposer,
  AgentNoticeView,
  AgentSelectionChip,
} from '@/components/ui/agent-panel/composer'
import { AgentTranscript } from '@/components/ui/agent-panel/transcript'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type {
  AgentAction,
  AgentMessage,
  AgentNotice,
  AgentRuntimeStatus,
  AgentSelectionContext,
  AgentTurnStatus,
  ElementSet,
} from '@/lib/agent-types'
import { cn } from '@/lib/utils'

interface AgentSurfaceProps {
  messages: readonly AgentMessage[]
  turnStatus: AgentTurnStatus
  runtimeStatus: AgentRuntimeStatus
  /** Shown in place of the composer while the runtime is unavailable or errored. */
  notice?: AgentNotice | null
  modelLabel?: string
  sets?: readonly ElementSet[]
  selection?: AgentSelectionContext | null
  /** While a turn runs, submitting the composer calls onSteer instead when it is provided. */
  onSend: (text: string, options?: { includeSelection?: boolean }) => void | Promise<void>
  onCancel: () => void
  onSteer?: (text: string) => void | Promise<void>
  onUndo?: (action: AgentAction) => void
  onSelectSet?: (set: ElementSet) => void
  onReset?: () => void
  className?: string
}

type AgentPanelVariant = 'docked' | 'sheet'

interface AgentPanelProps extends AgentSurfaceProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Controlled width in pixels; persist it from `onWidthChange`. */
  width?: number
  defaultWidth?: number
  onWidthChange?: (width: number) => void
  minWidth?: number
  /** Defaults to 60% of the panel's container. */
  maxWidth?: number
  heading?: string
  variant?: AgentPanelVariant
}

const DEFAULT_WIDTH = 400
const DEFAULT_MIN_WIDTH = 360
const DEFAULT_MAX_RATIO = 0.6
const KEY_STEP = 16
const KEY_STEP_LARGE = 64
const COMPACT_QUERY = '(max-width: 767px)'

const fallbackNotice: AgentNotice = {
  title: "The agent isn't available right now",
  description: 'The viewer keeps working meanwhile.',
  tone: 'warning',
}

function useAgentPanelVariant(query: string = COMPACT_QUERY): AgentPanelVariant {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  const compact = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
  return compact ? 'sheet' : 'docked'
}

function AgentPanel({
  messages,
  turnStatus,
  runtimeStatus,
  notice,
  modelLabel,
  sets,
  selection,
  onSend,
  onCancel,
  onSteer,
  onUndo,
  onSelectSet,
  onReset,
  className,
  open = true,
  onOpenChange,
  width,
  defaultWidth = DEFAULT_WIDTH,
  onWidthChange,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth,
  heading = 'Agent',
  variant = 'docked',
}: AgentPanelProps) {
  const headingId = useId()
  const resizeHintId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [internalWidth, setInternalWidth] = useState(defaultWidth)
  const [showDetails, setShowDetails] = useState(false)
  const [includeSelection, setIncludeSelection] = useState(false)

  const currentWidth = width ?? internalWidth
  const hasSelection = Boolean(selection && selection.dbIds.length > 0)
  const blocked = runtimeStatus === 'unavailable' || runtimeStatus === 'error'

  function upperBound(): number {
    if (maxWidth !== undefined) return maxWidth
    const container = panelRef.current?.parentElement?.clientWidth ?? 0
    return container > 0 ? container * DEFAULT_MAX_RATIO : Number.POSITIVE_INFINITY
  }

  function commitWidth(next: number): void {
    const clamped = Math.round(Math.max(minWidth, Math.min(next, upperBound())))
    if (width === undefined) setInternalWidth(clamped)
    onWidthChange?.(clamped)
  }

  function renderedWidth(): number {
    return panelRef.current?.getBoundingClientRect().width ?? currentWidth
  }

  const header = (title: React.ReactNode) => (
    <div className="flex min-h-12 shrink-0 items-center gap-2 border-border border-b py-1 ps-4 pe-2">
      {title}
      {modelLabel && (
        <span className="min-w-0 truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
          {modelLabel}
        </span>
      )}
      <div className="flex-1" />
      <Button
        type="button"
        variant="outline"
        aria-pressed={showDetails}
        className="h-8 px-2.5 text-xs aria-pressed:bg-muted aria-pressed:text-foreground"
        onClick={() => setShowDetails((value) => !value)}
      >
        Details
      </Button>
      {onReset && (
        <Button
          type="button"
          variant="ghost"
          aria-label="New conversation"
          className="size-10 text-muted-foreground"
          onClick={onReset}
        >
          <PlusIcon aria-hidden />
        </Button>
      )}
      {onOpenChange && (
        <Button
          type="button"
          variant="ghost"
          aria-label={`Close ${heading.toLowerCase()} panel`}
          className="size-10 text-muted-foreground"
          onClick={() => onOpenChange(false)}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  )

  const footer = blocked ? (
    <div className="shrink-0 border-border border-t p-4">
      <AgentNoticeView notice={notice ?? fallbackNotice} />
    </div>
  ) : (
    <div className="flex shrink-0 flex-col gap-2 border-border border-t px-4 pt-2 pb-3">
      {notice && <AgentNoticeView notice={notice} />}
      {sets && sets.length > 0 && onSelectSet && (
        <ul aria-label="Element sets" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
          {sets.map((set) => (
            <li key={set.id} className="shrink-0">
              <Button
                type="button"
                variant="outline"
                aria-label={`Select ${set.id}, ${set.label}, ${set.dbIds.length} elements`}
                className="h-9 gap-1.5 rounded-full px-3 text-xs"
                onClick={() => onSelectSet(set)}
              >
                <span className="font-mono">{set.id}</span>
                <span className="max-w-40 truncate text-muted-foreground">{set.label}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {selection && hasSelection && (
        <AgentSelectionChip
          selection={selection}
          included={includeSelection}
          onIncludedChange={(included) => {
            setIncludeSelection(included)
            if (included) textareaRef.current?.focus()
          }}
        />
      )}
      <AgentComposer
        turnStatus={turnStatus}
        runtimeStatus={runtimeStatus}
        onSend={onSend}
        onCancel={onCancel}
        onSteer={onSteer}
        includeSelection={includeSelection && hasSelection}
        onIncludeSelectionChange={setIncludeSelection}
        textareaRef={textareaRef}
      />
    </div>
  )

  const transcript = (
    <AgentTranscript
      messages={messages}
      turnStatus={turnStatus}
      sets={sets}
      showDetails={showDetails}
      assistantLabel={heading}
      emptyState="Ask about the model, or tell the agent what to show."
      onUndo={onUndo}
      onSelectSet={onSelectSet}
    />
  )

  if (variant === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={(next) => onOpenChange?.(next)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          data-slot="agent-panel"
          data-variant="sheet"
          className={cn(
            'gap-0 rounded-t-2xl p-0 data-[side=bottom]:h-[min(85dvh,44rem)]',
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
          {header(<SheetTitle className="font-semibold text-sm">{heading}</SheetTitle>)}
          {transcript}
          {footer}
        </SheetContent>
      </Sheet>
    )
  }

  if (!open) return null

  return (
    <aside
      ref={panelRef}
      aria-labelledby={headingId}
      data-slot="agent-panel"
      data-variant="docked"
      style={{ width: currentWidth, minWidth, maxWidth: maxWidth ?? `${DEFAULT_MAX_RATIO * 100}%` }}
      className={cn(
        'relative flex h-full shrink-0 flex-col border-border border-s bg-background text-foreground',
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Resize ${heading.toLowerCase()} panel`}
        aria-describedby={resizeHintId}
        className="group/resize absolute inset-y-0 -start-1.5 z-10 flex w-3 cursor-col-resize touch-none justify-center outline-none"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          dragRef.current = { startX: event.clientX, startWidth: renderedWidth() }
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (!drag) return
          commitWidth(drag.startWidth + drag.startX - event.clientX)
        }}
        onPointerUp={(event) => {
          dragRef.current = null
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP
          const start = renderedWidth()
          if (event.key === 'ArrowLeft') commitWidth(start + step)
          else if (event.key === 'ArrowRight') commitWidth(start - step)
          else if (event.key === 'Home') commitWidth(minWidth)
          else if (event.key === 'End') commitWidth(upperBound())
          else return
          event.preventDefault()
        }}
      >
        <span
          aria-hidden
          className="h-full w-0.5 bg-transparent group-hover/resize:bg-border group-focus-visible/resize:w-1 group-focus-visible/resize:bg-ring"
        />
      </button>
      <span id={resizeHintId} className="sr-only">
        Drag, or use the Left and Right arrow keys. Home and End jump to the narrowest and widest.
      </span>
      {header(
        <h2 id={headingId} className="font-semibold text-sm">
          {heading}
        </h2>,
      )}
      {transcript}
      {footer}
    </aside>
  )
}

export {
  AgentPanel,
  type AgentPanelProps,
  type AgentPanelVariant,
  type AgentSurfaceProps,
  useAgentPanelVariant,
}
