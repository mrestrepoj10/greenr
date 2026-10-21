'use client'

import { cn } from '@/lib/utils'
import type { Scheme } from '@/lib/edge/types'
import { messages } from '@/lib/ui/messages'

const OPTIONS: { key: keyof typeof messages.schemes.options; schemes: Scheme[] }[] = [
  { key: 'EDGE', schemes: ['EDGE'] },
  { key: 'CASA', schemes: ['CASA'] },
  { key: 'both', schemes: ['EDGE', 'CASA'] },
]

const same = (a: readonly Scheme[], b: readonly Scheme[]) => a.length === b.length && a.every((s) => b.includes(s))

export interface SchemeSelectorProps {
  schemes: readonly Scheme[]
  onChange?: (schemes: Scheme[]) => void
  disabled?: boolean
}

/** EDGE, CASA or both: one segmented control, so the selection can never be empty. */
export function SchemeSelector({ schemes, onChange, disabled }: SchemeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label={messages.schemes.label}
      className="inline-flex h-7 items-center rounded-md border border-input bg-input/30 p-0.5"
      data-testid="scheme-selector"
    >
      {OPTIONS.map((option) => {
        const checked = same(option.schemes, schemes)
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled || !onChange}
            onClick={() => {
              if (!checked) onChange?.(option.schemes)
            }}
            data-testid="scheme-option"
            data-value={option.key}
            className={cn(
              'h-6 rounded-[5px] px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60',
              checked && 'bg-background text-foreground shadow-xs',
            )}
          >
            {messages.schemes.options[option.key]}
          </button>
        )
      })}
    </div>
  )
}
