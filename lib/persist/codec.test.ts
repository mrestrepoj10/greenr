import { describe, expect, it } from 'vitest'
import { fixtureRun } from '@/lib/export/fixture'
import { CHUNK_SIZE, assembleElements, fromStoredRun, gapKey, orientationKey, toStoredRun } from './codec'

describe('run codec', () => {
  it('round-trips the fixture through the stored shape', () => {
    const stored = toStoredRun(fixtureRun)
    const rebuilt = fromStoredRun(stored.run, stored.elements, stored.classifications, stored.exclusions)
    expect(rebuilt).toEqual(fixtureRun)
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

  it('maps exclusion confirmation onto a three-state status', () => {
    const stored = toStoredRun({
      ...fixtureRun,
      exclusions: [
        { ...fixtureRun.exclusions[0], confirmed: false },
        { ...fixtureRun.exclusions[1], confirmed: true, note: undefined },
      ],
    })
    expect(stored.exclusions.map((e) => e.status)).toEqual(['proposed', 'accepted'])
    expect('note' in stored.exclusions[1]).toBe(false)
  })

  it('leaves rejected exclusions out of a rebuilt run', () => {
    const stored = toStoredRun(fixtureRun)
    const rows = stored.exclusions.map((row, i) => (i === 0 ? { ...row, status: 'rejected' as const } : row))
    const rebuilt = fromStoredRun(stored.run, stored.elements, stored.classifications, rows)
    expect(rebuilt.exclusions.map((e) => e.id)).toEqual(fixtureRun.exclusions.slice(1).map((e) => e.id))
  })
})
