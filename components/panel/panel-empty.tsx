import { Skeleton } from '@/components/ui/skeleton'
import { messages } from '@/lib/ui/messages'

export function PanelEmpty() {
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-6" data-testid="panel-empty">
      <h2 className="text-sm font-medium">{messages.empty.title}</h2>
      <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
        {messages.empty.lines.map((line, i) => (
          <li key={line} className="flex gap-3">
            <span className="w-4 shrink-0 text-right tabular-nums">{i + 1}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 border-t px-4 py-4" data-testid="panel-skeleton" aria-busy>
      <p className="text-sm text-muted-foreground">{messages.measuring}</p>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 pt-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="ml-auto h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}
