import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RunState } from '@/lib/edge/types'
import { messages } from '@/lib/ui/messages'

const BADGE_VARIANT: Record<RunState, 'outline' | 'secondary' | 'default'> = {
  idle: 'outline',
  loading: 'secondary',
  snapshot: 'secondary',
  classifying: 'secondary',
  measuring: 'secondary',
  provisional: 'secondary',
  confirmed: 'default',
  exported: 'default',
}

const BUSY: ReadonlySet<RunState> = new Set(['loading', 'snapshot', 'classifying', 'measuring'])

export interface PanelHeaderProps {
  state: RunState
  hasRun: boolean
  onCheck?: () => void
  onExport?: () => void
}

export function PanelHeader({ state, hasRun, onCheck, onExport }: PanelHeaderProps) {
  const busy = BUSY.has(state)
  const exportable = state === 'confirmed' || state === 'exported'
  return (
    <header className="flex flex-col gap-3 px-4 pt-4 pb-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-sm font-medium">EDGE inputs</h1>
        <Badge variant={BADGE_VARIANT[state]} data-testid="run-state" data-state={state}>
          {busy ? <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden /> : null}
          {messages.state[state]}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onCheck} disabled={busy || !onCheck} data-testid="check-edge" className="flex-1">
          {hasRun && !busy ? messages.checkAgain : messages.check}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onExport}
          disabled={!exportable || !onExport}
          title={exportable ? undefined : messages.exportHint}
          data-testid="export-pack"
        >
          <Download data-icon="inline-start" aria-hidden />
          {messages.export}
        </Button>
      </div>
    </header>
  )
}
