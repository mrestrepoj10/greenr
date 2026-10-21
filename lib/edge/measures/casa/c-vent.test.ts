import { describe, expect, test } from 'vitest'
import { box, classify, element, facadeAlong, room, snapshotOf } from '../../__fixtures__/synthetic'
import type { Element, MeasureResult } from '../../types'
import { C_VENT, C_VENT_LABELS as L } from './c-vent'

const value = (r: MeasureResult, label: string) => r.inputs.find((i) => i.label === label)?.value

const wall = (a: [number, number], b: [number, number]) => {
  const g = facadeAlong('wall', a, b, 0, 3, 0.2)
  return element('Revit Walls', 'Basic Wall / Ext', { area: Math.hypot(b[0] - a[0], b[1] - a[1]) * 3, facade: g.facade, bbox: g.bbox })
}
const opening = (category: 'Revit Windows' | 'Revit Doors', typeKey: string, a: [number, number], b: [number, number], z0: number, h: number, params: Element['params'] = {}) => {
  const g = facadeAlong(category === 'Revit Doors' ? 'door' : 'window', a, b, z0, z0 + h, 0.1)
  return element(category, typeKey, { level: 'L1', width: Math.hypot(b[0] - a[0], b[1] - a[1]), height: h, facade: g.facade, bbox: g.bbox, params })
}
const numbered = (name: string, number: string, rect: [number, number, number, number]) => {
  const r = room(name, 'L1', rect, 0, 3)
  return { ...r, params: { ...r.params, Number: number } }
}

/** Unit 501: a bedroom and a living room of 13.69 m² each behind a south and a north wall. */
function flat(extra: Element[] = []) {
  const walls = [wall([0, 0], [8, 0]), wall([0, 4], [8, 4]), wall([0, 0], [0, 4]), wall([8, 0], [8, 4])]
  const bedroom = numbered('Habitación', '501-1', [0.15, 0.15, 3.85, 3.85])
  const living = numbered('Sala', '501-2', [4.15, 0.15, 7.85, 3.85])
  const slider = opening('Revit Windows', 'Ventana corrediza de dos hojas / 1.0 x 1.2', [1, 0], [2, 0], 1, 1.2)
  const plain = opening('Revit Windows', 'Ventana / Generic', [5, 0], [6, 0], 1, 1.2)
  const operable = opening('Revit Windows', 'Ventana / Op', [5, 4], [6.5, 4], 1, 1.2, { Operable: 0.25 })
  const snapshot = snapshotOf([...walls, bedroom, living, slider, plain, operable, ...extra], [{ name: 'L1', elevation: 0 }])
  const classifications = classify({
    'Basic Wall / Ext': 'exterior-wall',
    'Ventana corrediza de dos hojas / 1.0 x 1.2': 'window',
    'Ventana / Generic': 'window',
    'Ventana / Op': 'window',
    'Puerta corrediza con dos hojas / 1.6 x 2.2': 'door',
    'Room / Room': 'room',
  })
  return { snapshot, classifications, bedroom, living, slider, plain }
}

describe('C-VENT', () => {
  test('SBp1: useful opening over floor area per dwelling room, the slider at half its area, Operable as given', () => {
    const t = flat()
    const r = C_VENT.compute(t.snapshot, t.classifications, [], {})
    expect(value(r, 'Room Habitación 501-1: useful opening share of floor area')).toBeCloseTo(0.6 / 13.69, 9)
    expect(value(r, 'Room Sala 501-2: useful opening share of floor area')).toBeCloseTo(0.45 / 13.69, 9)
    expect(value(r, L.rooms)).toBe(2)
    expect(r.inputs.find((i) => i.label === L.roomsAbove)).toMatchObject({ value: 1, dbIds: [t.bedroom.dbId] })
    expect(r.flags?.find((f) => f.id === 'C-VENT:rooms')).toMatchObject({ threshold: 0.04, guide: { page: '172' } })
  })

  test('a window without Operable blocks the claim; the family-name share is labelled an assumption', () => {
    const t = flat()
    const r = C_VENT.compute(t.snapshot, t.classifications, [], {})
    expect(r.state).toBe('blocked')
    expect(r.gaps.map((g) => [g.typeKey, g.missing, g.severity])).toEqual([
      ['Ventana corrediza de dos hojas / 1.0 x 1.2', 'Operable', 'blocks-claim'],
      ['Ventana / Generic', 'Operable', 'blocks-claim'],
    ])
    expect(r.gaps[0].message).toContain('assumed share')
    expect(r.gaps[0].dbIds).toEqual([t.slider.dbId])
  })

  test('SBc6: unit glazing over unit floor area, with a balcony slider door counted as glazing whatever its Function', () => {
    const door = opening('Revit Doors', 'Puerta corrediza con dos hojas / 1.6 x 2.2', [6, 0], [7.6, 0], 0, 2.2, { Function: 'Interior' })
    const without = flat()
    const base = C_VENT.compute(without.snapshot, without.classifications, [], {})
    expect(value(base, L.unitRule)).toBe('room-number')
    expect(value(base, 'Unit 501: glazing share of floor area')).toBeCloseTo((1.2 + 1.2 + 1.8) / 27.38, 9)
    expect(value(base, L.unitsAtLeast)).toBe(1)

    const t = flat([door])
    const r = C_VENT.compute(t.snapshot, t.classifications, [], {})
    expect(value(r, 'Unit 501: glazing share of floor area')).toBeCloseTo((1.2 + 1.2 + 1.8 + 3.52) / 27.38, 9)
    expect(value(r, 'Room Sala 501-2: useful opening share of floor area')).toBeCloseTo((0.45 + 1.76) / 13.69, 9)
    expect(r.flags?.map((f) => f.id)).toEqual([])
  })

  test('with rooms unplaced it blocks the room shares and still reports unit glazing from Tipo comments', () => {
    const tagged = { Comments: 'Tipo 1' }
    const floor = element('Revit Floors', 'Floor / Mortero de 0.05', { level: 'Nivel 5', area: 30, params: tagged })
    const w = () => element('Revit Windows', 'Ventana corrediza de dos hojas / 1.5 x 1.2', { level: 'Nivel 5', width: 1.5, height: 1.2, params: tagged })
    const door = element('Revit Doors', 'Puerta corrediza con dos hojas / 2.0 x 2.2', { level: 'Nivel 5', width: 2, height: 2.2, params: { ...tagged, Function: 'Interior' } })
    const ghost = element('Revit Rooms', 'Room / Room', { area: 0, params: { Name: 'Habitación' } })
    const cls = classify({ 'Ventana corrediza de dos hojas / 1.5 x 1.2': 'window', 'Puerta corrediza con dos hojas / 2.0 x 2.2': 'door' })
    const r = C_VENT.compute(snapshotOf([floor, w(), w(), door, ghost], [{ name: 'Nivel 5', elevation: 22.69 }]), cls, [], {})
    expect(r.gaps.map((g) => g.missing)).toEqual(['Operable', 'Placed rooms'])
    expect(value(r, L.rooms)).toBeUndefined()
    expect(value(r, L.unitRule)).toBe('comments-tipo')
    expect(value(r, 'Unit Nivel 5 Tipo 1: glazing share of floor area')).toBeCloseTo((1.8 + 1.8 + 4.4) / 30, 9)
  })

  test('an office model has no dwelling units and says so', () => {
    const { snapshot, classifications } = box()
    const r = C_VENT.compute(snapshot, classifications, [], {})
    expect(r.gaps.find((g) => g.missing === 'Dwelling units')?.severity).toBe('blocks-claim')
  })
})
