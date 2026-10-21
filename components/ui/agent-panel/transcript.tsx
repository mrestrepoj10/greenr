'use client'

import { LoaderCircleIcon } from 'lucide-react'
import Image from 'next/image'
import type * as React from 'react'
import { useEffect, useRef } from 'react'

import { AgentActionCard, agentImageSrc } from '@/components/ui/agent-panel/action-card'
import type {
  AgentAction,
  AgentImagePart,
  AgentMessage,
  AgentTurnStatus,
  ElementSet,
} from '@/lib/agent-types'
import { cn } from '@/lib/utils'

const PINNED_THRESHOLD_PX = 32

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

type TranscriptSegment =
  | { key: string; kind: 'text'; text: string }
  | { key: string; kind: 'reasoning'; text: string }
  | { key: string; kind: 'image'; image: AgentImagePart }
  | { key: string; kind: 'actions'; actions: AgentAction[] }

function segmentsOf(message: AgentMessage): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  for (let index = 0; index < message.parts.length; index += 1) {
    const part = message.parts[index]
    const key = `${message.id}:${index}`
    const previous = segments.at(-1)
    if (part.type === 'action') {
      if (previous?.kind === 'actions') previous.actions.push(part.action)
      else segments.push({ key, kind: 'actions', actions: [part.action] })
    } else if (part.type === 'text') {
      if (previous?.kind === 'text') previous.text += part.text
      else if (part.text.trim()) segments.push({ key, kind: 'text', text: part.text })
    } else if (part.type === 'reasoning') {
      if (previous?.kind === 'reasoning') previous.text += part.text
      else segments.push({ key, kind: 'reasoning', text: part.text })
    } else {
      segments.push({ key, kind: 'image', image: part })
    }
  }
  return segments
}

function MessageImage({ image }: { image: AgentImagePart }) {
  return (
    <Image
      src={agentImageSrc(image)}
      unoptimized
      alt={image.alt ?? 'Image from the conversation'}
      width={image.width ?? 320}
      height={image.height ?? 180}
      className="h-auto max-h-60 w-full max-w-80 rounded-md border border-border bg-muted object-contain"
    />
  )
}

interface AgentTranscriptProps extends Omit<React.ComponentProps<'div'>, 'children' | 'ref'> {
  messages: readonly AgentMessage[]
  turnStatus?: AgentTurnStatus
  sets?: readonly ElementSet[]
  showDetails?: boolean
  /** Names the assistant in each message header. */
  assistantLabel?: string
  /** Shown while there are no messages. */
  emptyState?: React.ReactNode
  onUndo?: (action: AgentAction) => void
  onSelectSet?: (set: ElementSet) => void
  /** Replaces the card for an action, for tools with their own surface such as a question. */
  renderAction?: (action: AgentAction) => React.ReactNode | undefined
  /** Replaces an assistant text segment, for structured answers. `streaming` is true while its turn runs. */
  renderText?: (text: string, streaming: boolean) => React.ReactNode | undefined
}

function AgentTranscript({
  messages,
  turnStatus = 'idle',
  sets,
  showDetails = false,
  assistantLabel = 'Agent',
  emptyState,
  onUndo,
  onSelectSet,
  renderAction,
  renderText,
  className,
  ...props
}: AgentTranscriptProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return
    viewport.scrollTop = viewport.scrollHeight
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) viewport.scrollTop = viewport.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  const setsById = new Map(sets?.map((set) => [set.id, set]))
  const busy = turnStatus !== 'idle'

  return (
    <div
      ref={viewportRef}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      data-slot="agent-transcript"
      onScroll={(event) => {
        const viewport = event.currentTarget
        pinnedRef.current =
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < PINNED_THRESHOLD_PX
      }}
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}
      {...props}
    >
      <div ref={contentRef} className="flex min-h-full flex-col gap-5 p-4">
        {messages.length === 0 && !busy && emptyState ? (
          <div className="my-auto text-center text-muted-foreground text-sm">{emptyState}</div>
        ) : null}
        {messages.map((message, messageIndex) => {
          const streaming = busy && messageIndex === messages.length - 1
          const time = new Date(message.createdAt)
          const author = message.role === 'user' ? 'You' : assistantLabel
          const header = (
            <p className="text-muted-foreground text-xs">
              {author} ·{' '}
              <time dateTime={time.toISOString()} suppressHydrationWarning>
                {timeFormatter.format(time)}
              </time>
            </p>
          )

          if (message.role === 'user') {
            return (
              <article
                key={message.id}
                data-slot="agent-message"
                data-role="user"
                className="flex flex-col items-end gap-1"
              >
                {header}
                {segmentsOf(message).map((segment) =>
                  segment.kind === 'text' ? (
                    <p
                      key={segment.key}
                      className="max-w-[88%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-muted px-3 py-2.5 text-sm"
                    >
                      {segment.text}
                    </p>
                  ) : segment.kind === 'image' ? (
                    <MessageImage key={segment.key} image={segment.image} />
                  ) : null,
                )}
              </article>
            )
          }

          return (
            <article
              key={message.id}
              data-slot="agent-message"
              data-role="assistant"
              className="flex flex-col gap-2"
            >
              {header}
              {segmentsOf(message).map((segment) => {
                switch (segment.kind) {
                  case 'text': {
                    const custom = renderText?.(segment.text, streaming)
                    if (custom !== undefined) return <div key={segment.key}>{custom}</div>
                    return (
                      <p
                        key={segment.key}
                        className="whitespace-pre-wrap break-words text-sm leading-relaxed"
                      >
                        {segment.text}
                      </p>
                    )
                  }
                  case 'reasoning':
                    return (
                      <details key={segment.key} className="text-muted-foreground text-xs">
                        <summary className="cursor-pointer select-none py-1">Reasoning</summary>
                        <p className="whitespace-pre-wrap break-words pt-1">{segment.text}</p>
                      </details>
                    )
                  case 'image':
                    return <MessageImage key={segment.key} image={segment.image} />
                  default:
                    return (
                      <ul
                        key={segment.key}
                        aria-label="Viewer actions"
                        className="flex flex-col gap-1.5"
                      >
                        {segment.actions.map((action) => {
                          const custom = renderAction?.(action)
                          if (custom !== undefined) return <li key={action.id}>{custom}</li>
                          return (
                            <AgentActionCard
                              key={action.id}
                              action={action}
                              set={action.setId ? setsById.get(action.setId) : undefined}
                              showDetails={showDetails}
                              onUndo={onUndo}
                              onSelectSet={onSelectSet}
                            />
                          )
                        })}
                      </ul>
                    )
                }
              })}
            </article>
          )
        })}
        {busy && (
          <p className="flex items-center gap-2 text-muted-foreground text-xs">
            <span aria-hidden className="grid size-3.5 animate-spin place-items-center">
              <LoaderCircleIcon className="size-3.5" />
            </span>
            {turnStatus === 'cancelling' ? 'Stopping' : 'Working'}
          </p>
        )}
      </div>
    </div>
  )
}

export { AgentTranscript, type AgentTranscriptProps }
