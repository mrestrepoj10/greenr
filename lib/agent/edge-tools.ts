import { ELEMENT_ROLES, EXCLUSION_REASONS, MEASURE_CODES } from '@/lib/edge/types'
import type {
  ElementRole,
  Exclusion,
  ExclusionReason,
  InputValue,
  MeasureCode,
  MeasureResult,
  RunResult,
} from '@/lib/edge/types'
import { openExclusions, pendingTypes } from '@/lib/run/pipeline'
import { messages } from '@/lib/ui/messages'
import type { ToolSpec } from './registry'

/** What the EDGE tools may read and propose. The person confirms everything in the panel. */
export interface EdgeSession {
  run(): RunResult | null
  elementsOf(typeKey: string): number[]
  /** Adds an unconfirmed agent exclusion and recomputes. Proposing the same ids and reason again changes nothing. */
  proposeExclusion(exclusion: { dbIds: number[]; reason: ExclusionReason; note: string }): Promise<Exclusion | null>
  /** Puts a role up for confirmation: the type turns pending with the agent's answer preselected. */
  proposeClassification(typeKey: string, role: ElementRole, reason: string): Promise<boolean>
  /** Element ids of a viewer set the agent saved, such as set-2 or "selection". */
  resolveSet(id: string): readonly number[] | undefined
}

const MAX_SUMMARY_INPUTS = 6

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits
const cite = (m: Pick<MeasureResult, 'guide'>) => `EDGE V3.1 Part ${m.guide.part} p.${m.guide.page}`

function inputRow(i: InputValue) {
  return { label: i.label, value: typeof i.value === 'number' ? round(i.value, 2) : i.value, unit: i.unit, source: i.source }
}

function noRun(): never {
  throw new Error('No check has run yet. Ask the person to click Check for EDGE.')
}

function measureDigest(m: MeasureResult, full: boolean) {
  const inputs = full ? m.inputs : m.inputs.slice(0, MAX_SUMMARY_INPUTS)
  return {
    code: m.code,
    guide: cite(m),
    guideTitle: m.guide.title,
    state: m.state,
    inputs: inputs.map(inputRow),
    ...(inputs.length < m.inputs.length ? { moreInputs: m.inputs.length - inputs.length } : {}),
    ...(m.orientations
      ? {
          orientations: m.orientations.map((o) => ({
            orientation: o.orientation,
            wallAreaM2: round(o.wallAreaM2, 1),
            glazingAreaM2: round(o.glazingAreaM2, 1),
            wwrPercent: o.wwr === null ? null : round(o.wwr * 100, 1),
          })),
        }
      : {}),
    gaps: full
      ? m.gaps.map((g) => ({ id: g.id, typeKey: g.typeKey, missing: g.missing, severity: g.severity, message: g.message, elements: g.dbIds.length }))
      : m.gaps.length,
    pendingTypes: full ? m.pendingTypeKeys : m.pendingTypeKeys.length,
    ...(m.flags?.length ? { flags: m.flags.map((f) => ({ level: f.level, message: f.message, guide: cite(f) })) } : {}),
  }
}

function envelopeDigest(m: MeasureResult) {
  if (!m.envelope) return undefined
  const tally = (rows: { counted: boolean; reason: string }[]) => {
    const byReason = new Map<string, number>()
    for (const row of rows) if (!row.counted) byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1)
    return {
      counted: rows.filter((r) => r.counted).length,
      notCounted: [...byReason].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([reason, count]) => ({ reason, count })),
    }
  }
  return { walls: tally(m.envelope.walls), openings: tally(m.envelope.openings) }
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export const agentExclusionId = (reason: ExclusionReason, dbIds: readonly number[]) =>
  `agent:${reason}:${fnv1a([...dbIds].sort((a, b) => a - b).join(','))}`

export function edgeToolSpecs(session: EdgeSession): ToolSpec[] {
  const requireRun = () => session.run() ?? noRun()
  const json = (value: unknown) => JSON.stringify(value)

  return [
    {
      name: 'edge_run_summary',
      description:
        'The current EDGE check: run state, north, every measure with its EDGE code, guide part and page, state and first inputs, the WWR per orientation, gap and pending counts, and every exclusion with whether the person accepted it. No element ids. Call this before you talk about any number.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      idempotent: true,
      mutates: false,
      run: async () => {
        const run = requireRun()
        return {
          text: json({
            runId: run.runId,
            state: run.state,
            guideVersion: run.guideVersion,
            view: run.snapshot.viewableName,
            units: run.snapshot.units,
            north: run.snapshot.north,
            measures: run.measures.map((m) => measureDigest(m, false)),
            exclusions: run.exclusions.map((e) => ({
              id: e.id,
              reason: e.reason,
              source: e.source,
              accepted: e.confirmed,
              note: e.note ?? null,
              elements: e.dbIds.length,
            })),
            pendingTypes: pendingTypes(run).length,
          }),
          label: messages.agent.tools.summary,
          detail: messages.state[run.state],
        }
      },
    },
    {
      name: 'edge_measure',
      description:
        'One EDGE measure in full: every input with its source, the orientation rows, every gap with the missing parameter and element count, flags, pending types, and for EEM01 why walls and openings did or did not count. Codes: D-GIA, D-FLOORS, D-F2F, D-ROOF, EEM01, EEM02, EEM09, AU-SKYLIGHT.',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', enum: MEASURE_CODES } },
        required: ['code'],
        additionalProperties: false,
      },
      idempotent: true,
      mutates: false,
      run: async (args) => {
        const run = requireRun()
        const code = args.code as MeasureCode
        const m = run.measures.find((x) => x.code === code)
        if (!m) throw new Error(`The run has no measure ${code}.`)
        return {
          text: json({ ...measureDigest(m, true), pendingExclusionIds: m.pendingExclusionIds ?? [], evidence: envelopeDigest(m) }),
          label: messages.agent.tools.measure(code),
          detail: cite(m),
        }
      },
    },
    {
      name: 'edge_pending',
      description:
        'What waits on the person: element types whose role is not confirmed (with the current answer, its source and confidence, and how many elements) and proposed exclusions not yet accepted (with reason, note and element count). The run stays provisional until both lists are empty.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      idempotent: true,
      mutates: false,
      run: async () => {
        const run = requireRun()
        const types = pendingTypes(run).map((c) => ({
          typeKey: c.typeKey,
          role: c.role,
          source: c.source,
          confidence: round(c.confidence, 2),
          reason: c.reason,
          elements: session.elementsOf(c.typeKey).length,
        }))
        const exclusions = openExclusions(run).map((e) => ({
          id: e.id,
          reason: e.reason,
          source: e.source,
          note: e.note ?? null,
          elements: e.dbIds.length,
        }))
        return {
          text: json({ state: run.state, pendingTypes: types, proposedExclusions: exclusions }),
          label: messages.agent.tools.pending,
          detail: messages.agent.tools.pendingDetail(types.length, exclusions.length),
        }
      },
    },
    {
      name: 'edge_propose_exclusion',
      description:
        'Propose leaving elements out of the measures, for example massing or context walls, below-grade walls, party walls, parapets or unconditioned spaces. Pass dbIds or the setId of a set you found. It is only a proposal: it shows in the panel and changes nothing until the person accepts it. Proposing the same elements and reason again changes nothing.',
      parameters: {
        type: 'object',
        properties: {
          dbIds: { type: 'array', items: { type: 'integer' }, maxItems: 20000 },
          setId: { type: 'string', description: 'A set from find_elements or "selection", instead of dbIds.' },
          reason: { type: 'string', enum: EXCLUSION_REASONS },
          note: { type: 'string', maxLength: 300, description: 'Why, in one sentence the person reads in the panel.' },
        },
        required: ['reason', 'note'],
        additionalProperties: false,
      },
      idempotent: true,
      mutates: true,
      run: async (args) => {
        requireRun()
        const fromSet = typeof args.setId === 'string' ? session.resolveSet(args.setId) : undefined
        if (typeof args.setId === 'string' && !fromSet) throw new Error(`No set ${args.setId}. Call list_sets.`)
        const dbIds = [...new Set([...(fromSet ?? []), ...((args.dbIds as number[] | undefined) ?? [])])]
        if (dbIds.length === 0) throw new Error('Pass dbIds or a setId with at least one element.')
        const exclusion = await session.proposeExclusion({
          dbIds,
          reason: args.reason as ExclusionReason,
          note: args.note as string,
        })
        if (!exclusion) throw new Error('The proposal did not apply. Ask the person to check again.')
        return {
          text: json({ id: exclusion.id, elements: dbIds.length, status: 'proposed, waiting for the person to accept it in the panel' }),
          label: messages.agent.tools.proposedExclusion(messages.exclusionReasons[exclusion.reason]),
          detail: messages.elements(dbIds.length),
        }
      },
    },
    {
      name: 'edge_set_classification',
      description:
        'Propose the EDGE role of one element type (typeKey as edge_pending lists it, "Family / Type"). The type turns pending with your role preselected; the measures use it only after the person confirms it in the panel.',
      parameters: {
        type: 'object',
        properties: {
          typeKey: { type: 'string', maxLength: 300 },
          role: { type: 'string', enum: ELEMENT_ROLES },
          reason: { type: 'string', maxLength: 300, description: 'Why, in one sentence the person reads in the panel.' },
        },
        required: ['typeKey', 'role', 'reason'],
        additionalProperties: false,
      },
      idempotent: true,
      mutates: true,
      run: async (args) => {
        requireRun()
        const typeKey = args.typeKey as string
        const role = args.role as ElementRole
        if (session.elementsOf(typeKey).length === 0) {
          throw new Error(`No elements of type "${typeKey}" in this check. Use the typeKey exactly as edge_pending lists it.`)
        }
        const ok = await session.proposeClassification(typeKey, role, args.reason as string)
        if (!ok) throw new Error('The proposal did not apply. Ask the person to check again.')
        return {
          text: json({ typeKey, role, status: 'proposed, waiting for the person to confirm it in the panel' }),
          label: messages.agent.tools.proposedRole(messages.roles[role]),
          detail: typeKey,
        }
      },
    },
  ]
}
