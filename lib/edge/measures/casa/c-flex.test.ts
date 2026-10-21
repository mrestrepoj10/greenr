import { describe, expect, test } from 'vitest'
import { classify, element, room, snapshotOf } from '../../__fixtures__/synthetic'
import type { Element, MeasureResult } from '../../types'
import { C_FLEX, C_FLEX_LABELS as L } from './c-flex'

const value = (r: MeasureResult, label: string) => r.inputs.find((i) => i.label === label)?.value
const wall = (typeKey: string, width: number, area: number, params: Element['params'] = {}) => element('Revit Walls', typeKey, { width, area, params })
const cls = classify({
  'Basic Wall / Mamposteria 0.10': 'interior-wall',
  'Basic Wall / Muro concreto 0.15': 'interior-wall',
  'Basic Wall / Drywall': 'interior-wall',
  'Basic Wall / Pintura': 'interior-wall',
  'Floor / Losa': 'floor',
  'Room / Room': 'room',
})
const tipoLevels = [
  { name: 'Nivel 1', elevation: 10.49 },
  { name: 'Nivel 2', elevation: 13.54 },
  { name: 'Nivel 3', elevation: 15.84 },
]
const tipoFloors = () => tipoLevels.map((l) => element('Revit Floors', 'Floor / Mortero', { level: l.name, area: 50, params: { Comments: 'Tipo 1' } }))

describe('C-FLEX', () => {
  const partitions = [
    wall('Basic Wall / Mamposteria 0.10', 0.1, 30, { Structural: 0, 'Structural Usage': 'Non-bearing' }),
    wall('Basic Wall / Muro concreto 0.15', 0.15, 20, { Structural: 1, 'Structural Usage': 'Bearing' }),
    wall('Basic Wall / Drywall', 0.12, 10),
    wall('Basic Wall / Pintura', 0.005, 30, { Structural: 0 }),
  ]
  const floors = tipoFloors()
  const r = C_FLEX.compute(snapshotOf([...partitions, ...floors], tipoLevels), cls, [], {})

  test('non-structural share of partition area, finish layers and walls without the parameter left out', () => {
    expect(value(r, L.partitions)).toBe(60)
    expect(value(r, L.skins)).toBe(30)
    expect(value(r, L.share)).toBeCloseTo(30 / 50, 9)
    expect(value(r, L.unknown)).toBe(10)
    expect(r.gaps.map((g) => [g.typeKey, g.severity])).toEqual([['Basic Wall / Drywall', 'info']])
    expect(r.flags?.find((f) => f.id === 'C-FLEX:share')).toBeUndefined()
  })

  test('with rooms unplaced, slab to slab is the step between levels carrying units, flagged under 2.40 m', () => {
    expect(value(r, L.spaces)).toBe(2)
    expect(value(r, L.minHeight)).toBeCloseTo(2.3, 9)
    expect(r.inputs.find((i) => i.label === L.below)).toMatchObject({ value: 1, source: 'levels', dbIds: [floors[1].dbId] })
    expect(r.flags?.find((f) => f.id === 'C-FLEX:height')).toMatchObject({ threshold: 2.4, guide: { page: '236' } })
  })

  test('a share of exactly half is flagged: Mc4 asks for more than 50%', () => {
    const even = [wall('Basic Wall / Mamposteria 0.10', 0.1, 20, { 'Structural Usage': 'Non-bearing' }), wall('Basic Wall / Muro concreto 0.15', 0.15, 20, { Structural: 1 })]
    const half = C_FLEX.compute(snapshotOf([...even, ...tipoFloors()], tipoLevels), cls, [], {})
    expect(value(half, L.share)).toBe(0.5)
    expect(half.flags?.map((f) => f.id)).toContain('C-FLEX:share')
  })

  test('partitions with no Structural parameter at all block the claim', () => {
    const blind = C_FLEX.compute(snapshotOf([wall('Basic Wall / Drywall', 0.12, 10), ...tipoFloors()], tipoLevels), cls, [], {})
    expect(blind.state).toBe('blocked')
    expect(blind.blockedBy).toEqual([{ kind: 'missing-parameter', parameter: 'Structural or Structural Usage' }])
    expect(blind.gaps.map((g) => [g.missing, g.severity])).toEqual([['Structural or Structural Usage', 'needs-data-sheet']])
    expect(value(blind, L.share)).toBeNull()
  })

  test('with placed rooms, slab to slab is measured per habitable room from the slab above it', () => {
    const rooms = [room('Habitación', 'L0', [0, 0, 10, 10], 0, 2.7), room('Habitación', 'L1', [0, 0, 10, 10], 3, 5.7)]
    const slab = (top: number) => element('Revit Floors', 'Floor / Losa', { area: 100, bbox: [0, 0, top - 0.2, 10, 10, top] })
    const levels = [
      { name: 'L0', elevation: 0 },
      { name: 'L1', elevation: 3 },
    ]
    const placed = C_FLEX.compute(snapshotOf([...partitions, ...rooms, slab(3), slab(6)], levels), cls, [], {})
    expect(placed.inputs.find((i) => i.label === L.minHeight)).toMatchObject({ source: 'rooms' })
    expect(value(placed, L.minHeight)).toBeCloseTo(3, 9)
    expect(value(placed, L.spaces)).toBe(2)
  })
})
