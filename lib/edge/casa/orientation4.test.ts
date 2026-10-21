import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { box } from '../__fixtures__/synthetic'
import { proposeExclusions } from '../exclusions'
import { tallyFacade } from '../measures/eem01'
import type { Classification, Orientation, OrientationRow, Snapshot } from '../types'
import { binCardinal, cardinalRows, type Cardinal } from './orientation4'

const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8')) as T

describe('binCardinal', () => {
  test('90 degree sectors centred on the cardinals', () => {
    expect([0, 44.99, 90, 134.99, 180, 224.99, 270, 314.99, 359.99].map((az) => binCardinal(az))).toEqual(['N', 'N', 'E', 'E', 'S', 'S', 'W', 'W', 'N'])
  })

  test('an exact sector edge goes to the clockwise sector', () => {
    expect([45, 135, 225, 315].map((az) => binCardinal(az))).toEqual(['E', 'S', 'W', 'N'])
  })

  test('azimuths are taken relative to true north and wrap', () => {
    expect(binCardinal(90, 90)).toBe('N')
    expect(binCardinal(0, 30)).toBe('N')
    expect(binCardinal(0, 50)).toBe('W')
    expect(binCardinal(-45)).toBe('N')
    expect(binCardinal(405)).toBe('E')
  })
})

describe('cardinalRows', () => {
  test('a façade 50 degrees off north goes wholly to one cardinal, where EDGE puts it on a diagonal', () => {
    const { snapshot, classifications } = box({ northAngleDeg: 50 })
    const tally = tallyFacade(snapshot, classifications, [])
    const rows = cardinalRows(snapshot, tally.walls, tally.openings)
    const south = tally.rows.find((r) => r.orientation === 'SE')!
    expect(south.wallAreaM2).toBeCloseTo(137 + 3, 9)
    expect(rows.find((r) => r.orientation === 'E')!.wallAreaM2).toBeCloseTo(137 + 3, 9)
    expect(rows.find((r) => r.orientation === 'E')!.glazingAreaM2).toBeCloseTo(3, 9)
    expect(rows.map((r) => r.orientation)).toEqual(['N', 'E', 'S', 'W'])
  })

  describe('210 King', () => {
    const snapshot = load<Snapshot>('210king.json')
    const classifications = load<Classification[]>('210king.classifications.json')
    const accepted = proposeExclusions(snapshot, classifications).map((e) => ({ ...e, status: 'accepted' as const }))
    const tally = tallyFacade(snapshot, classifications, accepted)
    const four = cardinalRows(snapshot, tally.walls, tally.openings)
    const eight = new Map(tally.rows.map((r) => [r.orientation, r]))
    const sum = (rows: OrientationRow[], key: 'wallAreaM2' | 'glazingAreaM2') => rows.reduce((s, r) => s + r[key], 0)

    test('N+E+S+W gross façade and glazing equal the 8-orientation totals within 0.1 m²', () => {
      expect(Math.abs(sum(four, 'wallAreaM2') - sum(tally.rows, 'wallAreaM2'))).toBeLessThan(0.1)
      expect(Math.abs(sum(four, 'glazingAreaM2') - sum(tally.rows, 'glazingAreaM2'))).toBeLessThan(0.1)
      expect(sum(four, 'wallAreaM2')).toBeGreaterThan(4000)
    })

    test('each cardinal holds its own 45 degree sector and at most its two neighbouring diagonals', () => {
      const neighbours: Record<Cardinal, [Orientation, Orientation]> = { N: ['NW', 'NE'], E: ['NE', 'SE'], S: ['SE', 'SW'], W: ['SW', 'NW'] }
      for (const row of four) {
        const own = eight.get(row.orientation)!.wallAreaM2
        const [a, b] = neighbours[row.orientation as Cardinal]
        expect(row.wallAreaM2).toBeGreaterThanOrEqual(own - 1e-6)
        expect(row.wallAreaM2).toBeLessThanOrEqual(own + eight.get(a)!.wallAreaM2 + eight.get(b)!.wallAreaM2 + 1e-6)
      }
    })
  })
})
