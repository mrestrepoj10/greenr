import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeRun, DEFAULT_SCOPE } from '@/lib/edge/run'
import { FIXTURE_SNAPSHOT } from '@/lib/classify/fixture'
import type { Classification, Exclusion, ExclusionStatus, Snapshot } from '@/lib/edge/types'
import {
  decisions,
  mergeExclusions,
  openExclusions,
  pendingTypes,
  runPipeline,
  withConfirmedType,
  withDecision,
  answerWithoutUser,
  type PipelinePhase,
} from './pipeline'

const snapshot = JSON.parse(readFileSync(join(__dirname, '../edge/__fixtures__/210king.json'), 'utf8')) as Snapshot

const proposal = (id: string, source: Exclusion['source'] = 'rule', status: ExclusionStatus = 'proposed'): Exclusion => ({
  id,
  dbIds: [1, 2],
  reason: 'massing',
  source,
  status,
})

describe('mergeExclusions', () => {
  it('keeps the person decision on a rule proposal across runs, a rejection included', () => {
    const merged = mergeExclusions(
      [proposal('rule:a'), proposal('rule:b'), proposal('rule:c')],
      [proposal('rule:a', 'rule', 'accepted'), proposal('rule:b', 'rule', 'rejected')],
    )
    expect(merged.map((e) => [e.id, e.status])).toEqual([
      ['rule:a', 'accepted'],
      ['rule:b', 'rejected'],
      ['rule:c', 'proposed'],
    ])
  })

  it('carries agent exclusions over with their status and drops stale rule rows', () => {
    const prior = [proposal('agent:x', 'agent'), proposal('agent:y', 'agent', 'rejected'), proposal('rule:gone', 'rule', 'accepted')]
    expect(mergeExclusions([], prior).map((e) => [e.id, e.status])).toEqual([
      ['agent:x', 'proposed'],
      ['agent:y', 'rejected'],
    ])
  })
})

describe('person decisions', () => {
  it('a confirmed type replaces the model answer', () => {
    const before: Classification[] = [{ typeKey: 't', role: 'other', source: 'model', confidence: 0.3, reason: 'm' }]
    expect(withConfirmedType(before, 't', 'exterior-wall')).toEqual([
      { typeKey: 't', role: 'exterior-wall', source: 'user', confidence: 1, reason: 'Confirmed by the user' },
    ])
  })

  it('accepting, rejecting and undoing set the status and keep the exclusion', () => {
    const list = [proposal('a'), proposal('b')]
    const rejected = withDecision(list, 'a', 'rejected')
    expect(rejected.map((e) => e.status)).toEqual(['rejected', 'proposed'])
    expect(withDecision(rejected, 'a', 'proposed')).toEqual(list)
    expect(withDecision(list, 'b', 'accepted').map((e) => e.status)).toEqual(['proposed', 'accepted'])
  })

  it('lists accepted and rejected exclusions and user types as decided', () => {
    const run = computeRun(FIXTURE_SNAPSHOT, withConfirmedType([], 'Basic Wall / Generic - 200mm', 'interior-wall'), [
      proposal('a', 'rule', 'accepted'),
      proposal('b', 'rule', 'rejected'),
      proposal('c'),
    ], DEFAULT_SCOPE)
    const decided = decisions(run)
    expect(decided.exclusions.map((e) => e.id)).toEqual(['a', 'b'])
    expect(decided.types.map((c) => c.typeKey)).toEqual(['Basic Wall / Generic - 200mm'])
  })
})

describe('answerWithoutUser', () => {
  const noModel = async () => {
    throw new Error('the rules settle this type')
  }

  it('hands a rule-settled type back to its rule', async () => {
    const typeKey = 'Basic Wall / Exterior - Brick on Block'
    const confirmed = withConfirmedType([], typeKey, 'interior-wall')
    const after = await answerWithoutUser(FIXTURE_SNAPSHOT, confirmed, typeKey, noModel)
    expect(after).toEqual([expect.objectContaining({ typeKey, role: 'exterior-wall', source: 'rule' })])
  })

  it('asks the decision model again for a type no rule settles, and leaves it pending', async () => {
    const typeKey = 'Basic Wall / Generic - 200mm'
    const asked: string[] = []
    const after = await answerWithoutUser(FIXTURE_SNAPSHOT, withConfirmedType([], typeKey, 'exterior-wall'), typeKey, async (items) => {
      asked.push(...items.map((i) => i.typeKey))
      return items.map((i) => ({ typeKey: i.typeKey, role: 'interior-wall' as const, source: 'model' as const, confidence: 0.7, reason: 'm' }))
    })
    expect(asked).toEqual([typeKey])
    expect(after).toEqual([expect.objectContaining({ typeKey, role: 'interior-wall', source: 'model' })])
    const run = computeRun(FIXTURE_SNAPSHOT, after, [], DEFAULT_SCOPE)
    expect(decisions(run).types).toEqual([])
  })

  it('leaves the type without an answer when the decision model fails', async () => {
    const typeKey = 'Basic Wall / Generic - 200mm'
    const after = await answerWithoutUser(FIXTURE_SNAPSHOT, withConfirmedType([], typeKey, 'exterior-wall'), typeKey, async () => {
      throw new Error('gateway down')
    })
    expect(after).toEqual([])
  })
})

describe('runPipeline on 210 King', () => {
  it('reads, classifies and measures, then settles once every exclusion is accepted', async () => {
    const phases: PipelinePhase[] = []
    const live = await runPipeline(
      {
        readSnapshot: async () => snapshot,
        classify: async () => [],
        onPhase: async (phase) => {
          phases.push(phase)
        },
      },
      { classifications: [], exclusions: [] },
      DEFAULT_SCOPE,
    )
    expect(phases.map((p) => p.kind)).toEqual(['snapshot', 'measuring'])
    expect(live.run.state).toBe('provisional')
    expect(pendingTypes(live.run)).toEqual([])
    const open = openExclusions(live.run)
    expect(open.length).toBeGreaterThan(0)

    const exclusions = open.reduce((list, e) => withDecision(list, e.id, 'accepted'), live.run.exclusions)
    const settled = computeRun(live.snapshot, live.run.classifications, exclusions, DEFAULT_SCOPE, live.run)
    expect(settled.state).toBe('confirmed')
    expect(settled.runId).toBe(live.run.runId)
    const s = settled.measures.find((m) => m.code === 'EEM01')!.orientations!.find((o) => o.orientation === 'S')!
    expect(s.wwr).toBeGreaterThan(0.4)
    expect(s.wwr).toBeLessThan(0.5)
  })

  it('undoing an accepted exclusion reverts its numbers and reopens the run; rejecting settles it without them', async () => {
    const live = await runPipeline(
      { readSnapshot: async () => snapshot, classify: async () => [], onPhase: async () => {} },
      { classifications: [], exclusions: [] },
      DEFAULT_SCOPE,
    )
    const accepted = live.run.exclusions.map((e) => ({ ...e, status: 'accepted' as const }))
    const wwr = (exclusions: Exclusion[]) => {
      const run = computeRun(live.snapshot, live.run.classifications, exclusions, DEFAULT_SCOPE, live.run)
      return { state: run.state, rows: run.measures.find((m) => m.code === 'EEM01')!.orientations!.map((o) => o.wwr) }
    }
    const settled = wwr(accepted)
    const undone = wwr(withDecision(accepted, 'rule:party-wall', 'proposed'))
    const rejected = wwr(withDecision(accepted, 'rule:party-wall', 'rejected'))
    expect(undone.state).toBe('provisional')
    expect(undone.rows).not.toEqual(settled.rows)
    expect(rejected).toEqual({ state: 'confirmed', rows: undone.rows })
    expect(wwr(withDecision(withDecision(accepted, 'rule:party-wall', 'proposed'), 'rule:party-wall', 'accepted'))).toEqual(settled)
  })

  it('asks the decision model only for leftovers and leaves unanswered ones pending', async () => {
    const stripped = { ...snapshot, elements: snapshot.elements.map((e) => (e.category === 'Revit Walls' ? { ...e, params: {} } : e)) }
    let asked = 0
    const live = await runPipeline(
      {
        readSnapshot: async () => stripped,
        classify: async (items) => {
          asked = items.length
          return items.map((i) => ({ typeKey: i.typeKey, role: 'other' as const, source: 'model' as const, confidence: 0, reason: 'unavailable' }))
        },
        onPhase: async () => {},
      },
      { classifications: [], exclusions: [] },
      DEFAULT_SCOPE,
    )
    expect(asked).toBeGreaterThan(0)
    expect(live.unclassified).toBe(asked)
    expect(pendingTypes(live.run).length).toBeGreaterThan(0)
  })
})
