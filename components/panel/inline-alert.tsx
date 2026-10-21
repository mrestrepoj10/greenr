import { CircleAlert } from 'lucide-react'

export function InlineAlert({ children }: { children: string }) {
  return (
    <div
      role="alert"
      data-testid="panel-alert"
      className="mx-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}
