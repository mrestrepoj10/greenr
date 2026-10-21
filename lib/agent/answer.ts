import { defineCatalog, type Spec } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'
import { ALL_MEASURE_CODES, ORIENTATIONS } from '@/lib/edge/types'

/**
 * The answer cards the agent composes. Cards that show numbers take a measure code and read the value from the
 * current run, so every number on a card is the engine's, with its EDGE code and guide page.
 */
export const answerCatalog = defineCatalog(schema, {
  components: {
    note: {
      props: z.object({ text: z.string().max(1200), tone: z.enum(['info', 'warning']).nullable().optional() }),
      description:
        'A short paragraph in plain English, **bold** and `code` allowed. The root of every answer is a note: its text is the lead sentence and its children are the cards that back it.',
    },
    stat: {
      props: z.object({ code: z.enum(ALL_MEASURE_CODES), input: z.string().max(200) }),
      description:
        'One measured input from the run, shown with its EDGE code and guide page. input is the label exactly as edge_run_summary or edge_measure lists it, for example "Overall window-to-wall ratio".',
    },
    orientation_table: {
      props: z.object({ highlight: z.array(z.enum(ORIENTATIONS)).max(8).nullable().optional() }),
      description: 'The EEM01 table of eight orientations from the run: wall area, glazing area and WWR. highlight marks rows to look at.',
    },
    gap_list: {
      props: z.object({ measure: z.enum(ALL_MEASURE_CODES).nullable().optional(), limit: z.number().int().min(1).max(20).nullable().optional() }),
      description: 'Gaps from the run: types missing a parameter EDGE asks for, each with its element count. Clicking a gap selects its elements.',
    },
    element_chips: {
      props: z.object({
        chips: z
          .array(
            z.object({
              label: z.string().max(80),
              dbIds: z.array(z.number().int()).max(5000).nullable().optional(),
              setId: z.string().max(40).nullable().optional(),
            }),
          )
          .min(1)
          .max(8),
      }),
      description: 'Buttons that select elements in the viewer. Each chip takes dbIds or the setId of a set you found.',
    },
    compass: {
      props: z.object({}),
      description: 'The north the run uses, its angle and where it came from.',
    },
    question: {
      props: z.object({ text: z.string().max(300), options: z.array(z.string().max(120)).min(1).max(4) }),
      description: 'Suggested follow-ups the person can click to send. Not for decisions: use ask_user_question for those.',
    },
    link: {
      props: z.object({ label: z.string().max(120), href: z.string().url().startsWith('https://') }),
      description: 'A link, for example to the EDGE guide page that a tool returned.',
    },
  },
  actions: {},
})

export type AnswerSpec = Spec

export const ANSWER_INSTRUCTIONS = `Answer format
- End every turn with one fenced \`\`\`json block and nothing after it. Before the block you may write one short sentence; the block is what the person reads.
- The block is a json-render spec: {"root": "<key>", "elements": {"<key>": {"type": "<component>", "props": {...}, "children": ["<key>", ...]}}}. The root is a note whose text is your lead sentence; its children are the cards.
- Components: ${Object.entries(answerCatalog.data.components)
  .map(([name, c]) => `${name} (${c.description})`)
  .join('; ')}.
- Props of each: note {text, tone?: "info"|"warning"}; stat {code, input}; orientation_table {highlight?: ["N",...]}; gap_list {measure?, limit?}; element_chips {chips: [{label, dbIds? | setId?}]}; compass {}; question {text, options: [..]}; link {label, href}.
- Use at most six cards. Never put a number in a note without its EDGE code and guide page; prefer a stat card, which carries them.
- Example: {"root":"a","elements":{"a":{"type":"note","props":{"text":"South has the highest window-to-wall ratio."},"children":["b","c"]},"b":{"type":"stat","props":{"code":"EEM01","input":"Overall window-to-wall ratio"}},"c":{"type":"orientation_table","props":{"highlight":["S"]}}}}`

/** Leaf cards may leave out `children`; the catalog schema wants the array. */
function withChildren(spec: unknown): unknown {
  if (typeof spec !== 'object' || spec === null) return spec
  const { elements } = spec as { elements?: Record<string, { children?: unknown }> }
  if (typeof elements !== 'object' || elements === null) return spec
  const filled = Object.fromEntries(
    Object.entries(elements).map(([key, el]) => [key, el && typeof el === 'object' && !('children' in el) ? { ...el, children: [] } : el]),
  )
  return { ...spec, elements: filled }
}

const FENCE = /```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/

/** Splits an assistant message into its prose and its card spec. A spec that does not parse or fit the catalog is null, and the whole text reads as prose. */
export function parseAnswer(text: string): { prose: string; spec: AnswerSpec | null } {
  const match = FENCE.exec(text.trimEnd())
  if (!match) return { prose: text, spec: null }
  try {
    const result = answerCatalog.validate(withChildren(JSON.parse(match[1])))
    if (!result.success || !result.data) return { prose: text, spec: null }
    // The catalog checks element types; each card's props are checked against its own schema here.
    const components = answerCatalog.data.components as Record<string, { props: z.ZodType }>
    for (const element of Object.values(result.data.elements)) {
      if (!components[element.type]?.props.safeParse(element.props).success) return { prose: text, spec: null }
    }
    return { prose: text.slice(0, match.index).trim(), spec: result.data as AnswerSpec }
  } catch {
    return { prose: text, spec: null }
  }
}

/** True while a reply is still streaming its card block, so the raw JSON never flashes on screen. */
export const isComposingCards = (text: string) => /```(?:json)?\s*\n/.test(text) && !FENCE.test(text.trimEnd())
