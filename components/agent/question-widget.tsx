'use client'

import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import type { AgentAction } from '@/lib/agent-types'
import type { Answers, Question, QuestionBroker } from '@/lib/agent/question'
import { messages } from '@/lib/ui/messages'
import { cn } from '@/lib/utils'

type Answered = { answers: { question: string; chosen: string[] }[] }

const questionsOf = (action: AgentAction): Question[] => {
  const input = action.input as { questions?: Question[] } | undefined
  return Array.isArray(input?.questions) ? input.questions : []
}

/** ask_user_question inline in the transcript: a fieldset per question while the turn waits, the choices after. */
export function QuestionWidget({ action, broker }: { action: AgentAction; broker: QuestionBroker }) {
  const pending = useSyncExternalStore(broker.subscribe, broker.current, () => null)
  const questions = questionsOf(action)
  const [chosen, setChosen] = useState<Answers>(() => questions.map(() => []))
  const answered = action.status === 'succeeded' ? (action.output as Answered | undefined)?.answers : undefined
  const live = action.status === 'running' && pending !== null

  if (!live) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-sm" data-testid="agent-question" data-state={answered ? 'answered' : action.status}>
        <p className="text-xs text-muted-foreground">{answered ? messages.agent.question.answered : messages.agent.question.legend}</p>
        {questions.map((q, i) => (
          <p key={i}>
            {q.question} <span className="text-muted-foreground">{answered?.[i]?.chosen.join('; ') || ''}</span>
          </p>
        ))}
      </div>
    )
  }

  const toggle = (qi: number, option: string, multiple: boolean) =>
    setChosen((prev) =>
      prev.map((list, i) =>
        i !== qi ? list : multiple ? (list.includes(option) ? list.filter((o) => o !== option) : [...list, option]) : [option],
      ),
    )
  const complete = questions.every((_, i) => chosen[i]?.length > 0)

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-ring/40 bg-accent/30 px-3 py-3"
      data-testid="agent-question"
      data-state="waiting"
      onSubmit={(event) => {
        event.preventDefault()
        if (complete) broker.answer(pending.id, chosen)
      }}
    >
      <p className="text-xs text-muted-foreground">{messages.agent.question.waiting}</p>
      {questions.map((q, qi) => (
        <fieldset key={qi} className="flex flex-col gap-1.5">
          <legend className="pb-1 text-sm">{q.question}</legend>
          <span className="sr-only">{q.multiple ? messages.agent.question.chooseAny : messages.agent.question.chooseOne}</span>
          {q.options.map((option) => {
            const selected = chosen[qi]?.includes(option) ?? false
            return (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                  selected ? 'border-ring bg-accent' : 'border-border hover:bg-accent/60',
                )}
                data-testid="agent-question-option"
              >
                <input
                  type={q.multiple ? 'checkbox' : 'radio'}
                  name={`${pending.id}-${qi}`}
                  value={option}
                  checked={selected}
                  onChange={() => toggle(qi, option, q.multiple ?? false)}
                  className="accent-foreground"
                />
                {option}
              </label>
            )
          })}
        </fieldset>
      ))}
      <Button type="submit" size="sm" disabled={!complete} data-testid="agent-question-submit" className="self-start">
        {messages.agent.question.submit}
      </Button>
    </form>
  )
}
