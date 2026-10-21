import { describe, expect, it } from 'vitest'
import { fixtureBothRun, fixtureRun } from '@/lib/export/fixture'
import { CHUNK_SIZE, assembleElements, fromStoredRun, gapKey, orientationKey, toStoredRun } from './codec'

describe('run codec', () => {
  it.each([
    ['EDGE', fixtureRun],
    ['EDGE and CASA', fixtureBothRun],
  ])('round-trips the %s fixture through the stored shape', (_, run) => {
    const stored = toStoredRun(run)
    const rebuilt = fromStoredRun(stored.run, stored.elements, stored.classifications, stored.exclusions)
    expect(rebuilt).toEqual(run)
  })

  it('stores every blocker kind, the flags and the pending exclusions of a CASA measure', () => {
    const { run } = toStoredRun(fixtureBothRun)
    const water = run.measures.find((m) => m.code === 'C-WATER')!
    expect(water.blockedBy).toEqual([
      { kind: 'missing-parameter', parameter: 'Flow or Flow Rate' },
      { kind: 'missing-elements', elements: 'dwelling-unit' },
    ])
    expect(water.flags?.map((f) => [f.id, f.threshold, f.guide.page])).toEqual([['C-WATER:lavatory', 8.3, '125']])
    const env = run.measures.find((m) => m.code === 'C-ENV')!
    expect(env.blockedBy).toEqual([{ kind: 'unplaced-rooms', count: 73, total: 73 }])
    expect(env.pendingExclusionIds).toEqual(['excl-p1'])
  })

  it('stores the schemes, the guide versions, the project inputs and why a measure is blocked', () => {
    const { run } = toStoredRun(fixtureBothRun)
    expect(run.schemes).toEqual(['EDGE', 'CASA'])
    expect(run.guides).toEqual({ EDGE: 'V3.1', CASA: '3.1 (Edición 2026)' })
    expect(run.inputs).toEqual(fixtureBothRun.inputs)
    expect(run.measures.find((m) => m.code === 'C-FLOOD')!.blockedBy).toEqual([{ kind: 'missing-input', input: 'roadGradeM' }])
    expect(run.measures.find((m) => m.code === 'EEM01')!.guide).toMatchObject({ doc: 'EDGE Part 3', version: 'V3.1', page: '14' })
    expect('blockedBy' in run.measures.find((m) => m.code === 'EEM01')!).toBe(false)
  })

  it('strips element ids from the run document', () => {
    const { run, elements } = toStoredRun(fixtureRun)
    const text = JSON.stringify(run)
    expect(text).not.toContain('wallDbIds')
    expect(text).not.toContain('"dbIds":[1201')
    const totalIds = elements.reduce((n, e) => n + e.dbIds.length, 0)
    expect(run.elementCount).toBe(totalIds)
    const eem01 = fixtureRun.measures.find((m) => m.code === 'EEM01')!
    const expected =
      eem01.orientations!.reduce((n, o) => n + o.wallDbIds.length + o.glazingDbIds.length, 0) +
      fixtureRun.measures.flatMap((m) => m.gaps).reduce((n, g) => n + g.dbIds.length, 0)
    expect(totalIds).toBe(expected)
  })

  it('chunks long id lists and reassembles them in order', () => {
    const dbIds = Array.from({ length: CHUNK_SIZE * 2 + 17 }, (_, i) => i)
    const run = {
      ...fixtureRun,
      measures: fixtureRun.measures.map((m) =>
        m.code === 'EEM01'
          ? { ...m, orientations: m.orientations!.map((o) => (o.orientation === 'N' ? { ...o, wallDbIds: dbIds } : o)) }
          : m,
      ),
    }
    const { elements } = toStoredRun(run)
    const key = orientationKey('EEM01', 'N', 'wall')
    const chunks = elements.filter((e) => e.key === key)
    expect(chunks.map((c) => c.dbIds.length)).toEqual([CHUNK_SIZE, CHUNK_SIZE, 17])
    const shuffled = [...elements].reverse()
    expect(assembleElements(shuffled).get(key)).toEqual(dbIds)
    expect(assembleElements(shuffled).get(gapKey('gap-eem02-sri'))).toEqual([5001, 5002])
  })

  it('keeps every exclusion status, rejected included, through a save and a load', () => {
    const exclusions = [
      { ...fixtureRun.exclusions[0], status: 'proposed' as const },
      { ...fixtureRun.exclusions[1], status: 'rejected' as const, note: undefined },
    ]
    const stored = toStoredRun({ ...fixtureRun, exclusions })
    expect(stored.exclusions.map((e) => e.status)).toEqual(['proposed', 'rejected'])
    expect('note' in stored.exclusions[1]).toBe(false)
    const loaded = fromStoredRun(stored.run, stored.elements, stored.classifications, stored.exclusions)
    expect(loaded.exclusions.map((e) => [e.id, e.status])).toEqual(exclusions.map((e) => [e.id, e.status]))
  })

  it('rebuilds a run from Convex documents that saves again without system fields', () => {
    const stored = toStoredRun(fixtureRun)
    const docs = stored.exclusions.map((row) => ({ ...row, _id: 'x', _creationTime: 1, projectId: 'p', updatedAt: 2 }))
    const rebuilt = fromStoredRun(stored.run, stored.elements, stored.classifications, docs)
    expect(toStoredRun(rebuilt).exclusions).toEqual(stored.exclusions)
  })
})
