'use client'

import { X } from 'lucide-react'
import { formatRatio } from '@/lib/ui/format'
import { messages } from '@/lib/ui/messages'
import { legendGradientCss, WWR_RAMP } from '@/lib/viewer/color'

export function StageLegend({ onClear }: { onClear: () => void }) {
  return (
    <div
      data-testid="stage-legend"
      className="absolute bottom-20 left-3 z-10 flex items-center gap-2 rounded-md border bg-background/85 px-2.5 py-1.5 text-xs backdrop-blur-sm"
    >
      <span className="text-muted-foreground">{messages.wwr.legend}</span>
      <span className="tabular-nums">{formatRatio(WWR_RAMP.from)}</span>
      <span className="h-1.5 w-24 rounded-full" style={{ background: legendGradientCss() }} aria-hidden />
      <span className="tabular-nums">{formatRatio(WWR_RAMP.to)}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={messages.wwr.clearColour}
        className="ml-1 rounded-sm p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
