import type { ReactNode } from 'react'
import type { GuideRef } from '@/lib/edge/types'
import { messages } from '@/lib/ui/messages'

export function GuideLink({ guide }: { guide: GuideRef }) {
  return (
    <a
      href={guide.url}
      target="_blank"
      rel="noreferrer"
      title={guide.title}
      className="shrink-0 text-xs text-muted-foreground tabular-nums underline-offset-4 hover:text-foreground hover:underline"
    >
      {messages.guide(guide.doc, guide.page)}
    </a>
  )
}

export interface MeasureSectionProps {
  title: string
  guide?: GuideRef
  aside?: ReactNode
  children: ReactNode
  testId?: string
}

export function MeasureSection({ title, guide, aside, children, testId }: MeasureSectionProps) {
  return (
    <section className="flex flex-col gap-3 border-t px-4 py-4" data-testid={testId}>
      <header className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {guide ? <GuideLink guide={guide} /> : null}
        {aside ? <div className="ml-auto flex items-center gap-2">{aside}</div> : null}
      </header>
      {children}
    </section>
  )
}
