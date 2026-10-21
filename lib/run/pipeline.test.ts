import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeRun } from '@/lib/edge/run'
import type { Classification, Exclusion, Snapshot } from '@/lib/edge/types'
import {
  mergeExclusions,
  openExclusions,
  pendingTypes,
  runPipeline,
  withConfirmedType,
  withDecision,
  type PipelinePhase,
  type PriorExclusion,
} from './pipeline'

const snapshot = JSON.parse(readFileSync(join(__dirname, '../edge/__fixtures__/210king.json'), 'utf8')) as Snapshot

const proposal = (id: string, source: Exclusion['source'] = 'rule'): Exclusion => ({
  id,
  dbIds: [1, 2],
  reason: 'massing',
  source,
  confirmed: false,
})

describe('mergeExclusions', () => {
  it('keeps the person decision on a rule proposal across runs', () => {
    const merged = mergeExclusions(
      [proposal('rule:a'), proposal('rule:b'), proposal('rule:c')],
      [
        { ...proposal('rule:a'), status: 'accepted' },
        { ...proposal('rule:b'), status: 'rejected' },
      ],
    )
    expect(merged.map((e) => [e.id, e.confirmed])).toEqual([
      ['rule:a', true],
      ['rule:c', false],
    ])
  })

  it('carries agent proposals over and drops stale rule rows', () => {
    const prior: PriorExclusion[] = [
      { ...proposal('agent:x', 'agent'), status: 'proposed' },
      { ...proposal('agent:y', 'agent'), status: 'rejected' },
      { ...proposal('rule:gone'), status: 'accepted' },
    ]
    expect(mergeExclusions([], prior).map((e) => e.id)).toEqual(['agent:x'])
  })
})

describe('person decisions', () => {
  it('a confirmed type replaces the model answer', () => {
    const before: Classification[] = [{ typeKey: 't', role: 'other', source: 'model', confidence: 0.3, reason: 'm' }]
    expect(withConfirmedType(before, 't', 'exterior-wall')).toEqual([
      { typeKey: 't', role: 'exterior-wall', source: 'user', confidence: 1, reason: 'Confirmed by the user' },
    ])
  })

  it('accepting confirms and rejecting removes', () => {
    const list = [proposal('a'), proposal('b')]
    expect(withDecision(list, 'a', true).map((e) => e.confirmed)).toEqual([true, false])
    expect(withDecision(list, 'a', false).map((e) => e.id)).toEqual(['b'])
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
    )
    expect(phases.map((p) => p.kind)).toEqual(['snapshot', 'measuring'])
    expect(live.run.state).toBe('provisional')
    expect(pendingTypes(live.run)).toEqual([])
    const open = openExclusions(live.run)
    expect(open.length).toBeGreaterThan(0)

    const exclusions = open.reduce((list, e) => withDecision(list, e.id, true), live.run.exclusions)
    const settled = computeRun(live.snapshot, live.run.classifications, exclusions, live.run)
    expect(settled.state).toBe('confirmed')
    expect(settled.runId).toBe(live.run.runId)
    const s = settled.measures.find((m) => m.code === 'EEM01')!.orientations!.find((o) => o.orientation === 'S')!
    expect(s.wwr).toBeGreaterThan(0.4)
    expect(s.wwr).toBeLessThan(0.5)
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
    )
    expect(asked).toBeGreaterThan(0)
    expect(live.unclassified).toBe(asked)
    expect(pendingTypes(live.run).length).toBeGreaterThan(0)
  })
})
