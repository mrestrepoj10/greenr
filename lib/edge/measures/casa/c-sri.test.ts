import { describe, expect, test } from 'vitest'
import { classify, element, snapshotOf } from '../../__fixtures__/synthetic'
import type { Element, MeasureResult } from '../../types'
import { C_SRI, C_SRI_LABELS as L } from './c-sri'

const value = (r: MeasureResult, label: string) => r.inputs.find((i) => i.label === label)?.value
const roof = (typeKey: string, area: number, params: Element['params']) => element('Revit Roofs', typeKey, { area, bbox: [0, 0, 9, 10, 10, 9.3], params })

describe('C-SRI', () => {
  const roofs = [
    roof('Cubierta / Losa', 100, { Slope: 0, 'Solar Reflectance Index': 70 }),
    roof('Cubierta / Teja', 50, { Slope: 1, SRI: 30 }),
    roof('Cubierta / Losa gris', 40, { Slope: 0.1, 'Solar Reflectance Index': 50 }),
    roof('Cubierta / Metalica', 10, { Slope: '30°', 'Solar Reflectance Index': 40 }),
    roof('Cubierta / Sin datos', 20, {}),
  ]
  const cls = classify(Object.fromEntries(roofs.map((r) => [r.typeKey, 'roof' as const])))
  const r = C_SRI.compute(snapshotOf(roofs, []), cls, [], {})

  test('splits roof area at 9.5° and counts the area whose SRI clears its own threshold', () => {
    expect(value(r, L.low)).toBe(140)
    expect(value(r, L.steep)).toBe(60)
    expect(value(r, L.noSlope)).toBe(20)
    expect(r.inputs.find((i) => i.label === L.above)).toMatchObject({ value: 110, dbIds: [roofs[0].dbId, roofs[3].dbId] })
    expect(value(r, L.share)).toBeCloseTo(110 / 220, 9)
  })

  test('flags each slope class against its own threshold', () => {
    expect(r.flags?.map((f) => [f.id, f.threshold, f.guide.page])).toEqual([
      ['C-SRI:low', 64, '94'],
      ['C-SRI:steep', 32, '94'],
    ])
    expect(r.flags?.[0].message).toContain('Cubierta / Losa gris (SRI 50)')
  })

  test('a roof type without SRI blocks the claim; one without Slope asks for it', () => {
    expect(r.state).toBe('blocked')
    expect(r.blockedBy).toEqual([{ kind: 'missing-parameter', parameter: 'Solar Reflectance Index' }])
    expect(r.gaps.map((g) => [g.typeKey, g.missing, g.severity])).toEqual([
      ['Cubierta / Sin datos', 'Solar Reflectance Index', 'needs-data-sheet'],
      ['Cubierta / Sin datos', 'Slope', 'needs-data-sheet'],
    ])
    const none = C_SRI.compute(snapshotOf([roofs[4]], []), cls, [], {})
    expect(value(none, L.share)).toBeNull()
  })

  test('9.5° is a low slope, so the 64 threshold applies there', () => {
    const edge = [roof('Cubierta / Borde', 10, { Slope: '9.5°', SRI: 50 }), roof('Cubierta / Empinada', 10, { Slope: '9.6°', SRI: 50 })]
    const e = C_SRI.compute(snapshotOf(edge, []), classify({ 'Cubierta / Borde': 'roof', 'Cubierta / Empinada': 'roof' }), [], {})
    expect(value(e, L.low)).toBe(10)
    expect(e.inputs.find((i) => i.label === L.above)?.dbIds).toEqual([edge[1].dbId])
  })
})
