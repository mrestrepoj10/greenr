'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Snapshot } from '@/lib/edge/types'
import { formatDegrees } from '@/lib/ui/format'
import { messages } from '@/lib/ui/messages'

export interface CompassRoseProps {
  north: Snapshot['north']
  onNorthChange?: (angleDeg: number) => void
}

export function CompassRose({ north, onNorthChange }: CompassRoseProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(north.angleDeg))
  const inputId = useId()

  const submit = () => {
    const value = Number(draft)
    if (Number.isFinite(value)) onNorthChange?.(((value % 360) + 360) % 360)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3" data-testid="compass">
      <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden className="shrink-0 text-muted-foreground">
        <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1" />
        {[0, 90, 180, 270].map((deg) => (
          <line
            key={deg}
            x1="24"
            y1="3"
            x2="24"
            y2="7"
            stroke="currentColor"
            strokeWidth="1"
            transform={`rotate(${deg} 24 24)`}
          />
        ))}
        <g transform={`rotate(${north.angleDeg} 24 24)`} data-testid="compass-needle">
          <polygon points="24,6 20,24 28,24" fill="currentColor" className="text-foreground" />
          <polygon points="24,42 20,24 28,24" fill="currentColor" opacity="0.25" />
          <text x="24" y="17" textAnchor="middle" fontSize="7" fill="var(--background)" fontWeight="600">
            N
          </text>
        </g>
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
        <span className="text-sm tabular-nums" data-testid="north-angle">
          {messages.wwr.north} {formatDegrees(north.angleDeg)}
          <span className="ml-2 text-muted-foreground">{messages.wwr.northSource[north.source]}</span>
        </span>
        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              {messages.wwr.northHelp}
            </label>
            <input
              id={inputId}
              type="number"
              step="0.5"
              min={-360}
              max={360}
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              title={messages.wwr.northHelp}
              className="h-7 w-20 rounded-md border border-input bg-input/30 px-2 text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              data-testid="north-input"
            />
            <span className="text-muted-foreground">°</span>
            <Button type="submit" size="xs" variant="secondary">
              {messages.wwr.apply}
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="w-fit -ml-2 text-muted-foreground"
            disabled={!onNorthChange}
            onClick={() => {
              setDraft(String(north.angleDeg))
              setEditing(true)
            }}
            data-testid="edit-north"
          >
            {messages.wwr.editNorth}
          </Button>
        )}
      </div>
    </div>
  )
}
