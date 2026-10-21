import type { ToolSpec } from './registry'

export type Question = {
  question: string
  options: string[]
  /** The person may pick more than one option. */
  multiple?: boolean
}

export type PendingQuestion = { id: string; questions: Question[] }

/** One list of chosen options per question, in question order. */
export type Answers = string[][]

/**
 * Holds the one question the agent is waiting on. The tool call awaits `ask`, so the turn blocks until the person
 * answers in the panel; libfx runs host tools one at a time, so there is never more than one.
 */
export class QuestionBroker {
  private pending: (PendingQuestion & { resolve: (answers: Answers) => void }) | null = null
  private readonly listeners = new Set<() => void>()
  private sequence = 0

  current = (): PendingQuestion | null => this.pending

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  ask(questions: Question[], signal: AbortSignal): Promise<Answers> {
    this.cancel()
    this.sequence += 1
    const id = `q-${this.sequence}`
    return new Promise<Answers>((resolve, reject) => {
      const onAbort = () => {
        if (this.pending?.id !== id) return
        this.pending = null
        this.emit()
        reject(new DOMException('The question was cancelled.', 'AbortError'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
      this.pending = {
        id,
        questions,
        resolve: (answers) => {
          signal.removeEventListener('abort', onAbort)
          resolve(answers)
        },
      }
      this.emit()
    })
  }

  answer(id: string, answers: Answers): boolean {
    const pending = this.pending
    if (!pending || pending.id !== id) return false
    this.pending = null
    this.emit()
    pending.resolve(answers)
    return true
  }

  private cancel() {
    if (this.pending) this.pending.resolve([])
    this.pending = null
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}

export const ASK_USER_QUESTION = 'ask_user_question'

export function askUserQuestionTool(broker: QuestionBroker): ToolSpec {
  return {
    name: ASK_USER_QUESTION,
    description:
      'Ask the person one to three multiple-choice questions and wait for the answers. The turn pauses until they answer in the panel. Use it for decisions only the person can make: which proposed exclusions to accept, what role an element type plays. Two to five short options per question.',
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', maxLength: 300 },
              options: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string', maxLength: 120 } },
              multiple: { type: 'boolean', description: 'Allow more than one option.' },
            },
            required: ['question', 'options'],
            additionalProperties: false,
          },
        },
      },
      required: ['questions'],
      additionalProperties: false,
    },
    idempotent: false,
    mutates: false,
    run: async (args, { signal }) => {
      const questions = args.questions as Question[]
      const answers = await broker.ask(questions, signal)
      const lines = questions.map((q, i) => `${q.question} -> ${answers[i]?.length ? answers[i].join('; ') : 'no answer'}`)
      return {
        text: JSON.stringify({ answers: questions.map((q, i) => ({ question: q.question, chosen: answers[i] ?? [] })) }),
        label: 'Asked you',
        detail: lines.join('\n'),
      }
    },
  }
}
