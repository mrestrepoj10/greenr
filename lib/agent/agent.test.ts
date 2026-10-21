import { describe, expect, it } from 'vitest'
import { fixtureRun } from '@/lib/export/fixture'
import type { ElementRole, Exclusion, ExclusionReason } from '@/lib/edge/types'
import { agentExclusionId, edgeToolSpecs, type EdgeSession } from './edge-tools'
import { askUserQuestionTool, QuestionBroker } from './question'
import { createAgentTools, violation } from './registry'

function fakeSession() {
  const proposals: Exclusion[] = []
  const roles: { typeKey: string; role: ElementRole }[] = []
  const session: EdgeSession = {
    run: () => fixtureRun,
    elementsOf: (typeKey) => (typeKey === 'Basic Wall / Generic - 200mm' ? [11, 12] : []),
    proposeExclusion: async ({ dbIds, reason, note }: { dbIds: number[]; reason: ExclusionReason; note: string }) => {
      const e: Exclusion = { id: agentExclusionId(reason, dbIds), dbIds, reason, source: 'agent', status: 'proposed', note }
      proposals.push(e)
      return e
    },
    proposeClassification: async (typeKey, role) => {
      roles.push({ typeKey, role })
      return true
    },
    resolveSet: (id) => (id === 'set-1' ? [7, 8, 9] : undefined),
  }
  return { session, proposals, roles }
}

const signal = new AbortController().signal

describe('tool registry', () => {
  it('rejects unknown parameters and wrong enums before a tool runs', async () => {
    const { session } = fakeSession()
    const tools = createAgentTools(edgeToolSpecs(session)).asAgentTools()
    const measure = tools.find((t) => t.name === 'edge_measure')!
    await expect(measure.execute({ code: 'EEM99' }, { signal })).rejects.toThrow(/must be one of/)
    await expect(measure.execute({ code: 'EEM01', extra: 1 }, { signal })).rejects.toThrow(/not a parameter/)
    expect(violation({ type: 'array', items: { type: 'integer' }, maxItems: 2 }, [1, 2, 3])).toMatch(/at most 2/)
  })
})

describe('EDGE tools', () => {
  it('summarise the run with codes and guide pages and no element ids', async () => {
    const { session } = fakeSession()
    const summary = await createAgentTools(edgeToolSpecs(session)).get('edge_run_summary')!.run({}, { signal })
    const body = JSON.parse(summary.text)
    const eem01 = fixtureRun.measures.find((m) => m.code === 'EEM01')!.guide
    expect(body.measures.find((m: { code: string }) => m.code === 'EEM01').guide).toBe(
      `EDGE V3.1 Part ${eem01.part} p.${eem01.page}`,
    )
    expect(summary.text).not.toMatch(/dbIds|wallDbIds/)
  })

  it('propose an exclusion from a saved set, with an id that repeats for the same elements', async () => {
    const { session, proposals } = fakeSession()
    const tool = createAgentTools(edgeToolSpecs(session)).get('edge_propose_exclusion')!
    await tool.run({ setId: 'set-1', reason: 'massing', note: 'context blocks' }, { signal })
    await tool.run({ dbIds: [9, 8, 7], reason: 'massing', note: 'again' }, { signal })
    expect(proposals.map((p) => p.dbIds.length)).toEqual([3, 3])
    expect(proposals[0].id).toBe(proposals[1].id)
    expect(proposals[0].status).toBe('proposed')
  })

  it('refuse a role for a type the check never saw', async () => {
    const { session, roles } = fakeSession()
    const tool = createAgentTools(edgeToolSpecs(session)).get('edge_set_classification')!
    await expect(tool.run({ typeKey: 'Nope', role: 'massing', reason: 'x' }, { signal })).rejects.toThrow(/No elements/)
    await tool.run({ typeKey: 'Basic Wall / Generic - 200mm', role: 'interior-wall', reason: 'core' }, { signal })
    expect(roles).toEqual([{ typeKey: 'Basic Wall / Generic - 200mm', role: 'interior-wall' }])
  })
})

describe('ask_user_question', () => {
  it('blocks until the person answers, then returns the choices', async () => {
    const broker = new QuestionBroker()
    const tool = askUserQuestionTool(broker)
    let settled = false
    const result = tool
      .run({ questions: [{ question: 'Accept the massing exclusions?', options: ['Accept all', 'Reject'] }] }, { signal })
      .then((r) => {
        settled = true
        return r
      })
    await Promise.resolve()
    expect(settled).toBe(false)
    const pending = broker.current()!
    expect(pending.questions[0].options).toEqual(['Accept all', 'Reject'])
    expect(broker.answer(pending.id, [['Accept all']])).toBe(true)
    expect(JSON.parse((await result).text).answers[0].chosen).toEqual(['Accept all'])
    expect(broker.current()).toBeNull()
  })

  it('gives up when the turn is cancelled', async () => {
    const broker = new QuestionBroker()
    const controller = new AbortController()
    const asked = askUserQuestionTool(broker).run(
      { questions: [{ question: 'Q?', options: ['a', 'b'] }] },
      { signal: controller.signal },
    )
    controller.abort()
    await expect(asked).rejects.toThrow(/cancelled/)
    expect(broker.current()).toBeNull()
  })
})
