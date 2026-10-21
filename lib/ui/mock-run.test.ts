import { expect, test } from 'vitest'
import { ORIENTATIONS } from '@/lib/edge/types'
import { MOCK_RUN } from './mock-run'

test('the fixture has eight orientations, two without a façade', () => {
  const rows = MOCK_RUN.measures.find((m) => m.code === 'EEM01')?.orientations ?? []
  expect(rows.map((r) => r.orientation)).toEqual([...ORIENTATIONS])
  expect(rows.filter((r) => r.wwr === null).length).toBeGreaterThanOrEqual(2)
  for (const row of rows) {
    if (row.wwr === null) continue
    expect(row.wallDbIds.length + row.glazingDbIds.length).toBeGreaterThan(0)
    expect(row.wwr).toBeCloseTo(row.glazingAreaM2 / row.wallAreaM2, 2)
  }
})

test('the fixture waits on three types and two exclusions', () => {
  expect(MOCK_RUN.state).toBe('provisional')
  expect(MOCK_RUN.classifications.filter((c) => c.source === 'model' && c.confidence < 0.6)).toHaveLength(3)
  expect(MOCK_RUN.exclusions.filter((e) => !e.confirmed)).toHaveLength(2)
  expect(MOCK_RUN.measures.flatMap((m) => m.gaps)).toHaveLength(3)
})

test('every measure cites a guide part and page', () => {
  for (const m of MOCK_RUN.measures) {
    expect(m.guide.url).toMatch(/^https:\/\/edgebuildings\.com\/.+\.pdf#page=\d+$/)
    expect(m.guide.page).toMatch(/^\d+(-\d+)?$/)
  }
})
