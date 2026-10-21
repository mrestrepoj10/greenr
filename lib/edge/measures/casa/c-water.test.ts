import { describe, expect, test } from 'vitest'
import { classify, element, snapshotOf } from '../../__fixtures__/synthetic'
import type { Element, MeasureResult } from '../../types'
import { C_WATER, C_WATER_LABELS as L, highestLabel } from './c-water'

const value = (r: MeasureResult, label: string) => r.inputs.find((i) => i.label === label)?.value
const fixture = (typeKey: string, params: Element['params'] = {}) => element('Revit Plumbing Fixtures', typeKey, { level: 'Nivel 1', params })
const cls = classify({
  'MezcladorDucha / Ducha': 'plumbing-fixture',
  'Lavamanos / Sobreponer': 'plumbing-fixture',
  'Inodoro / Tanque': 'plumbing-fixture',
  'Sifón / 2"': 'plumbing-fixture',
})

describe('C-WATER', () => {
  test('reads each fixture type against its NTC 1500 maximum and counts occupants as bedrooms plus one per unit', () => {
    const fixtures = [
      fixture('MezcladorDucha / Ducha', { Flow: 8 }),
      fixture('MezcladorDucha / Ducha', { Flow: 8 }),
      fixture('Lavamanos / Sobreponer', { 'Flow Rate': 9 }),
      fixture('Inodoro / Tanque', { Flush: 4.8 }),
      fixture('Sifón / 2"'),
    ]
    const floors = [
      ['Nivel 1', 'Tipo 1', 'Floor / Acabados Porcelanato Al.'],
      ['Nivel 1', 'Tipo 1', 'Floor / Acabados Porcelanato Al.'],
      ['Nivel 1', 'Tipo 2', 'Floor / Acabados Porcelanato Al.'],
    ].map(([level, tipo, typeKey]) => element('Revit Floors', typeKey, { level, area: 12, params: { Comments: tipo } }))
    const r = C_WATER.compute(snapshotOf([...fixtures, ...floors], []), cls, [], {})
    expect(r.state).toBe('ok')
    expect(value(r, 'Ducha: MezcladorDucha / Ducha')).toBe(8)
    expect(value(r, highestLabel('shower'))).toBe(8)
    expect(value(r, highestLabel('lavatory'))).toBe(9)
    expect(value(r, highestLabel('toilet'))).toBe(4.8)
    expect(value(r, L.units)).toBe(2)
    expect(value(r, L.occupants)).toBe(3 + 2)
    expect(r.flags?.map((f) => [f.id, f.threshold, f.guide.page])).toEqual([['C-WATER:lavatory', 8.3, '125']])
    expect(r.gaps.map((g) => [g.typeKey, g.missing, g.severity])).toEqual([['Sifón / 2"', 'Fixture kind', 'info']])
  })

  test('fixtures with no flow parameter block the claim once, with one gap per type naming the parameter', () => {
    const mixers = Array.from({ length: 3 }, () => fixture('MezcladorDucha / Ducha', { WFU: 0 }))
    const r = C_WATER.compute(snapshotOf([...mixers, fixture('Lavamanos / Sobreponer')], []), cls, [], {})
    expect(r.state).toBe('blocked')
    expect(r.blockedBy).toEqual([{ kind: 'missing-parameter', parameter: 'Flow or Flow Rate' }])
    const shower = r.gaps.find((g) => g.typeKey === 'MezcladorDucha / Ducha')!
    expect([shower.missing, shower.severity, shower.dbIds]).toEqual(['Flow or Flow Rate', 'needs-data-sheet', mixers.map((m) => m.dbId)])
    expect(shower.message).toContain('at 80 psi')
    expect(value(r, 'Ducha: MezcladorDucha / Ducha')).toBeNull()
    expect(value(r, highestLabel('shower'))).toBeUndefined()
  })

  test('a model without plumbing fixtures is blocked, not reported as compliant', () => {
    const r = C_WATER.compute(snapshotOf([], []), cls, [], {})
    expect(r.state).toBe('blocked')
    expect(r.blockedBy).toEqual([{ kind: 'missing-elements', elements: 'plumbing-fixture' }])
  })

  test('a flow under 1 L/min is questioned as a likely L/s reading', () => {
    const r = C_WATER.compute(snapshotOf([fixture('MezcladorDucha / Ducha', { Flow: 0.15 })], []), cls, [], {})
    expect(r.gaps.find((g) => g.id.endsWith(':unit'))).toMatchObject({ severity: 'needs-data-sheet', typeKey: 'MezcladorDucha / Ducha' })
  })

  test('an unclassified fixture type keeps the result provisional', () => {
    const r = C_WATER.compute(snapshotOf([fixture('MezcladorDucha / Ducha', { Flow: 8 }), fixture('Lavaplatos / Cocina', { Flow: 7 })], []), cls, [], {})
    expect(r.pendingTypeKeys).toEqual(['Lavaplatos / Cocina'])
  })
})
