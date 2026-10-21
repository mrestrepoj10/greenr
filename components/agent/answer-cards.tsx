'use client'

import { defineRegistry, JSONUIProvider, Renderer } from '@json-render/react'
import { ArrowUpRight, Navigation } from 'lucide-react'
import { createContext, Fragment, type ReactNode, useContext } from 'react'
import { GuideLink } from '@/components/panel/measure-section'
import { Button } from '@/components/ui/button'
import { answerCatalog, isComposingCards, parseAnswer } from '@/lib/agent/answer'
import type { GuideRef, MeasureResult, RunResult } from '@/lib/edge/types'
import { formatArea, formatDegrees, formatRatio, formatValue } from '@/lib/ui/format'
import { messages } from '@/lib/ui/messages'
import { cn } from '@/lib/utils'
import { wwrColorCss } from '@/lib/viewer/color'

export interface AnswerContextValue {
  run: RunResult | null
  /** Selects and frames the elements in the viewer. */
  select: (dbIds: readonly number[]) => void
  resolveSet: (id: string) => readonly number[] | undefined
  send: (text: string) => void
}

const AnswerContext = createContext<AnswerContextValue>({ run: null, select: () => {}, resolveSet: () => undefined, send: () => {} })

const measureOf = (run: RunResult | null, code: string): MeasureResult | undefined => run?.measures.find((m) => m.code === code)

function Cite({ code, guide }: { code: string; guide: GuideRef }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
      {code}
      <GuideLink guide={guide} />
    </span>
  )
}

const card = 'rounded-lg border bg-card/40 px-3 py-2.5'

/** Bold, inline code and line breaks: the little markdown the assistant writes. */
export function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-medium">
            {part.slice(2, -2)}
          </strong>
        ) : part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="rounded bg-muted px-1 font-mono text-[12px]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

/** Paragraphs and bullet or numbered lists, each line through InlineMarkdown. The fallback when a reply has no cards. */
export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed" data-testid="agent-markdown">
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        const list = lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l))
        if (list) {
          const Tag = /^\s*\d+\./.test(lines[0]) ? 'ol' : 'ul'
          return (
            <Tag key={i} className={cn('flex flex-col gap-1 pl-5', Tag === 'ol' ? 'list-decimal' : 'list-disc')}>
              {lines.map((l, j) => (
                <li key={j}>
                  <InlineMarkdown text={l.replace(/^\s*([-*]|\d+\.)\s+/, '')} />
                </li>
              ))}
            </Tag>
          )
        }
        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            <InlineMarkdown text={block} />
          </p>
        )
      })}
    </div>
  )
}

const { registry } = defineRegistry(answerCatalog, {
  components: {
    note: ({ props, children }) => (
      <div className="flex flex-col gap-2">
        <p className={cn('text-sm leading-relaxed', props.tone === 'warning' && 'text-status-warning')}>
          <InlineMarkdown text={props.text} />
        </p>
        {children}
      </div>
    ),
    stat: function Stat({ props }) {
      const { run } = useContext(AnswerContext)
      const measure = measureOf(run, props.code)
      const input = measure?.inputs.find((i) => i.label === props.input) ?? measure?.inputs.find((i) => i.label.startsWith(props.input))
      if (!measure || !input) return <p className="text-xs text-muted-foreground">{messages.agent.cards.notInRun(props.code, props.input)}</p>
      const ratio = input.unit === 'ratio' || /ratio|share/i.test(input.label)
      const value = typeof input.value === 'number' && ratio && input.value <= 1 ? formatRatio(input.value) : formatValue(input.value)
      return (
        <div className={cn(card, 'flex flex-col gap-1')} data-testid="answer-stat">
          <span className="text-xs text-muted-foreground">{input.label}</span>
          <span className="text-lg font-medium tabular-nums">
            {value} {ratio ? '' : <span className="text-sm text-muted-foreground">{input.unit}</span>}
          </span>
          <Cite code={measure.code} guide={measure.guide} />
        </div>
      )
    },
    orientation_table: function OrientationTable({ props }) {
      const { run, select } = useContext(AnswerContext)
      const measure = measureOf(run, 'EEM01')
      if (!measure?.orientations) return <p className="text-xs text-muted-foreground">{messages.agent.cards.notInRun('EEM01', 'orientations')}</p>
      const highlight = new Set(props.highlight ?? [])
      return (
        <div className={cn(card, 'flex flex-col gap-1.5')} data-testid="answer-orientations">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left font-normal">{messages.wwr.orientation}</th>
                <th className="text-right font-normal">{messages.wwr.wall}</th>
                <th className="text-right font-normal">{messages.wwr.glazing}</th>
                <th className="text-right font-normal">{messages.wwr.ratio}</th>
              </tr>
            </thead>
            <tbody>
              {measure.orientations.map((o) => (
                <tr
                  key={o.orientation}
                  onClick={() => o.wwr !== null && select([...o.wallDbIds, ...o.glazingDbIds])}
                  className={cn('h-6', o.wwr !== null && 'cursor-pointer hover:bg-accent/60', highlight.has(o.orientation) && 'bg-accent')}
                >
                  <th scope="row" className="text-left font-medium">{o.orientation}</th>
                  <td className="text-right">{o.wwr === null ? '' : formatArea(o.wallAreaM2)}</td>
                  <td className="text-right">{o.wwr === null ? '' : formatArea(o.glazingAreaM2)}</td>
                  <td className="text-right">
                    {o.wwr === null ? (
                      <span className="text-muted-foreground">{messages.wwr.noFacade}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: wwrColorCss(o.wwr) }} aria-hidden />
                        {formatRatio(o.wwr)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Cite code={measure.code} guide={measure.guide} />
        </div>
      )
    },
    gap_list: function GapList({ props }) {
      const { run, select } = useContext(AnswerContext)
      const measures = (run?.measures ?? []).filter((m) => !props.measure || m.code === props.measure)
      const gaps = measures.flatMap((m) => m.gaps.map((g) => ({ g, m })))
      const limit = props.limit ?? 6
      if (gaps.length === 0) return <p className="text-xs text-muted-foreground">{messages.agent.cards.noGaps}</p>
      return (
        <ul className={cn(card, 'flex flex-col gap-1.5')} data-testid="answer-gaps">
          {gaps.slice(0, limit).map(({ g, m }) => (
            <li key={g.id}>
              <button type="button" onClick={() => select(g.dbIds)} className="flex w-full flex-col items-start gap-0.5 text-left hover:text-foreground">
                <span className="text-xs">{g.typeKey}</span>
                <span className="text-[11px] text-muted-foreground">
                  {messages.gaps.missing(g.missing)} · {messages.elements(g.dbIds.length)}
                </span>
                <Cite code={m.code} guide={m.guide} />
              </button>
            </li>
          ))}
          {gaps.length > limit ? <li className="text-[11px] text-muted-foreground">{messages.agent.cards.moreGaps(gaps.length - limit)}</li> : null}
        </ul>
      )
    },
    element_chips: function ElementChips({ props }) {
      const { select, resolveSet } = useContext(AnswerContext)
      return (
        <div className="flex flex-wrap gap-1.5" data-testid="answer-chips">
          {props.chips.map((chip, i) => {
            const ids = chip.dbIds ?? (chip.setId ? resolveSet(chip.setId) : undefined) ?? []
            return (
              <Button key={i} size="xs" variant="outline" disabled={ids.length === 0} onClick={() => select(ids)} data-testid="answer-chip">
                {chip.label}
                <span className="text-muted-foreground tabular-nums">{ids.length}</span>
              </Button>
            )
          })}
        </div>
      )
    },
    compass: function Compass() {
      const { run } = useContext(AnswerContext)
      if (!run) return null
      const { north } = run.snapshot
      return (
        <div className={cn(card, 'flex items-center gap-2 text-sm')} data-testid="answer-compass">
          <Navigation className="size-4" style={{ transform: `rotate(${north.angleDeg}deg)` }} aria-hidden />
          {messages.agent.cards.north(formatDegrees(north.angleDeg), messages.wwr.northSource[north.source])}
        </div>
      )
    },
    question: function Question({ props }) {
      const { send } = useContext(AnswerContext)
      return (
        <div className="flex flex-col gap-1.5" data-testid="answer-question">
          <span className="text-xs text-muted-foreground">{props.text || messages.agent.cards.suggested}</span>
          <div className="flex flex-wrap gap-1.5">
            {props.options.map((option) => (
              <Button key={option} size="xs" variant="secondary" onClick={() => send(option)}>
                {option}
              </Button>
            ))}
          </div>
        </div>
      )
    },
    link: ({ props }) => (
      <a href={props.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline">
        {props.label}
        <ArrowUpRight className="size-3" aria-hidden />
      </a>
    ),
  },
})

export function AnswerProvider({ value, children }: { value: AnswerContextValue; children: ReactNode }) {
  return <AnswerContext.Provider value={value}>{children}</AnswerContext.Provider>
}

/** One assistant text segment: cards when it ends in a valid spec, markdown otherwise, a placeholder while cards stream. */
export function AnswerText({ text, streaming }: { text: string; streaming: boolean }) {
  if (streaming && isComposingCards(text)) {
    const lead = text.slice(0, text.indexOf('```')).trim()
    return (
      <div className="flex flex-col gap-2">
        {lead ? <Markdown text={lead} /> : null}
        <p className="animate-pulse text-xs text-muted-foreground">{messages.agent.cards.composing}</p>
      </div>
    )
  }
  const { prose, spec } = parseAnswer(text)
  if (!spec) return <Markdown text={text} />
  return (
    <div className="flex flex-col gap-2" data-testid="answer-cards">
      {prose ? <Markdown text={prose} /> : null}
      <JSONUIProvider registry={registry}>
        <Renderer spec={spec} registry={registry} />
      </JSONUIProvider>
    </div>
  )
}
