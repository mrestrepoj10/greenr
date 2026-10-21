import type { ReactNode } from 'react'
import type { GuideRef } from '@/lib/edge/types'
import { messages } from '@/lib/ui/messages'

export function GuideLink({ guide }: { guide: GuideRef }) {
  return (
    <a
      href={guide.url}
      target="_blank"
      rel="noreferrer"
      title={`${guide.title} (${guide.doc}, ${guide.version})`}
      className="shrink-0 text-xs text-muted-foreground tabular-nums underline-offset-4 hover:text-foreground hover:underline"
    >
      {messages.guide(guide.doc, guide.page)}
    </a>
  )
}

export function CreditChips({ credits }: { credits: readonly string[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-1" aria-label={messages.credits} data-testid="credit-chips">
      {credits.map((credit) => (
        <li key={credit} className="rounded-sm border border-border px-1.5 py-px font-mono text-[11px] leading-4 text-muted-foreground">
          {credit}
        </li>
      ))}
    </ul>
  )
}

export interface MeasureSectionProps {
  title: string
  guide?: GuideRef
  credits?: readonly string[]
  aside?: ReactNode
  children: ReactNode
  testId?: string
  code?: string
}

export function MeasureSection({ title, guide, credits, aside, children, testId, code }: MeasureSectionProps) {
  return (
    <section className="flex flex-col gap-3 border-t px-4 py-4" data-testid={testId} data-code={code}>
      <header className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium">{title}</h2>
          {guide ? <GuideLink guide={guide} /> : null}
          {aside ? <div className="ml-auto flex items-center gap-2">{aside}</div> : null}
        </div>
        {credits?.length ? <CreditChips credits={credits} /> : null}
      </header>
      {children}
    </section>
  )
}
