import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { proposeExclusions } from './exclusions'
import { computeRun } from './run'
import type { Classification, MeasureCode, Orientation, RunResult, Snapshot } from './types'

const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')) as T
const snapshot = load<Snapshot>('210king.json')
const classifications = load<Classification[]>('210king.classifications.json')

/** The spike's EEM01 table on 210 King, "New Construction" view, project north (scratchpad/spike/RESULT.md). m². */
const SPIKE: Record<Orientation, { gross: number; glazing: number }> = {
  N: { gross: 1227.3, glazing: 401.1 },
  NE: { gross: 0, glazing: 0 },
  E: { gross: 627.6, glazing: 125.8 },
  SE: { gross: 0, glazing: 0 },
  S: { gross: 1281.1, glazing: 560.2 },
  SW: { gross: 102.0, glazing: 27.3 },
  W: { gross: 1024.0, glazing: 407.0 },
  NW: { gross: 0, glazing: 0 },
}

/**
 * Where the engine deliberately differs from the spike. The spike's layer test skipped pairs that face the same way,
 * so it never fired; the 4" brick piers 451, 452 and 453 sit on the outer face of wall 445 and were counted twice.
 */
const CORRECTIONS = [{ orientation: 'S' as const, gross: -57.9, layers: [451, 452, 453], of: 445 }]

const measure = (run: RunResult, code: MeasureCode) => run.measures.find((m) => m.code === code)!
const value = (run: RunResult, code: MeasureCode, label: string) =>
  measure(run, code).inputs.find((i) => i.label.startsWith(label))!.value as number

describe('210 King golden snapshot', () => {
  const proposals = proposeExclusions(snapshot, classifications)
  const confirmed = computeRun(snapshot, classifications, proposals.map((e) => ({ ...e, confirmed: true })), undefined, 't')
  const pending = computeRun(snapshot, classifications, proposals, undefined, 't')
  const rows = measure(confirmed, 'EEM01').orientations!

  test.each(Object.keys(SPIKE) as Orientation[])('EEM01 %s matches the spike within 1%', (o) => {
    const row = rows.find((r) => r.orientation === o)!
    const correction = CORRECTIONS.find((c) => c.orientation === o)?.gross ?? 0
    const gross = SPIKE[o].gross + correction
    const glazing = SPIKE[o].glazing
    if (gross === 0) expect(row.wallAreaM2).toBe(0)
    else expect(Math.abs(row.wallAreaM2 - gross) / gross).toBeLessThan(0.01)
    if (glazing === 0) expect(row.glazingAreaM2).toBe(0)
    else expect(Math.abs(row.glazingAreaM2 - glazing) / glazing).toBeLessThan(0.01)
  })

  test('the correction is the layer rule at work: the brick piers are second layers of wall 445', () => {
    const walls = measure(confirmed, 'EEM01').envelope!.walls
    for (const c of CORRECTIONS) {
      for (const dbId of c.layers) {
        const wall = walls.find((w) => w.dbId === dbId)!
        expect(wall.counted).toBe(false)
        expect(wall.reason).toBe(`second layer of wall ${c.of}, counted once`)
      }
    }
  })

  test('design inputs match the spike within 1%', () => {
    const near = (actual: number, expected: number) => expect(Math.abs(actual - expected) / expected).toBeLessThan(0.01)
    near(value(confirmed, 'D-GIA', 'Gross internal area'), 11901)
    expect(value(confirmed, 'D-FLOORS', 'Floors above grade')).toBe(6)
    expect(value(confirmed, 'D-FLOORS', 'Floors below grade')).toBe(0)
    near(value(confirmed, 'D-F2F', 'Floor-to-floor'), 3.548)
    near(value(confirmed, 'D-ROOF', 'Aggregate roof area'), 2104.6)
  })

  test('before confirmation the run is provisional and still counts the massing roof', () => {
    expect(pending.state).toBe('provisional')
    expect(confirmed.state).toBe('confirmed')
    expect(value(pending, 'D-ROOF', 'Aggregate roof area')).toBeGreaterThan(2104.6 + 14000)
    expect(measure(pending, 'D-ROOF').pendingExclusionIds).toContain('rule:massing:Basic Roof / Massing_Roof')
  })

  test('every façade glazing type lacks U, SHGC and VT, because the model stores them as zero', () => {
    const eem09 = measure(confirmed, 'EEM09')
    expect(eem09.gaps.length).toBeGreaterThan(0)
    expect(eem09.gaps.every((g) => g.severity === 'needs-data-sheet')).toBe(true)
    expect(measure(confirmed, 'EEM02').state).toBe('blocked')
  })
})
