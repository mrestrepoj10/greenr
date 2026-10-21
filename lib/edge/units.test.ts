import { describe, expect, test } from 'vitest'
import { box, element, facadeAlong, room, snapshotOf } from './__fixtures__/synthetic'
import type { Element } from './types'
import { deriveUnits, dwellingSummary, occupantsOf } from './units'

const levels = [
  { name: 'L1', elevation: 3 },
  { name: 'L2', elevation: 6 },
]
const floor = (typeKey: string, level: string, area: number, comments?: string) =>
  element('Revit Floors', typeKey, { level, area, params: comments === undefined ? {} : { Comments: comments } })
const window = (level: string, a: [number, number], b: [number, number], params: Element['params'] = {}) => {
  const g = facadeAlong('window', a, b, 1, 2, 0.1)
  return element('Revit Windows', 'Ventana corrediza de dos hojas / 1.2 x 1.0', { level, width: 1, height: 1, facade: g.facade, bbox: g.bbox, params })
}
const numbered = (name: string, number: string, rect: [number, number, number, number], extra: Element['params'] = {}) => {
  const r = room(name, 'L1', rect, 0, 3)
  return { ...r, params: { ...r.params, Number: number, ...extra } }
}

describe('deriveUnits', () => {
  test('Comments "Tipo N" on a level names a unit; bedrooms come from finish floors, area from the floor type covering the unit', () => {
    const tipo1 = [
      floor('Floor / Acabados Porcelanato Al.', 'L1', 12, 'Tipo 1'),
      floor('Floor / Acabados Porcelanato Al.', 'L1', 10, 'Tipo 1'),
      floor('Floor / Acabado Piso baño PPAL', 'L1', 4, 'Tipo 1'),
      floor('Floor / Mortero de 0.05', 'L1', 58, 'Tipo 1'),
      floor('Floor / Balcon', 'L1', 70, 'Tipo 1'),
    ]
    const win = window('L1', [0, 0], [1, 0], { Comments: 'Tipo 1' })
    const door = element('Revit Doors', 'Puerta corrediza con dos hojas / 2.0 x 2.2', { level: 'L1', params: { Comments: 'tipo 1 ' } })
    const others = [
      floor('Floor / Acabados Porcelanato Al.', 'L1', 9, 'Apto tipo 2'),
      floor('Floor / Acabados Porcelanato Al.', 'L2', 12, 'Tipo 1'),
      element('Revit Floors', 'Floor / Acabados Porcelanato Al.', { area: 9, params: { Comments: 'Tipo 1' } }),
      element('Revit Rooms', 'Room / Room', { area: 0, params: { Name: 'Habitación', Comments: 'Apto tipo 1' } }),
      floor('Floor / Mortero de 0.05', 'L1', 40, 'Tipo 1 y 2'),
    ]
    const units = deriveUnits(snapshotOf([...tipo1, win, door, ...others], levels))
    expect(units.map((u) => [u.label, u.source])).toEqual([
      ['L1 Tipo 1', 'comments-tipo'],
      ['L1 Tipo 2', 'comments-tipo'],
      ['L2 Tipo 1', 'comments-tipo'],
    ])
    const [u] = units
    expect(u).toMatchObject({ level: 'L1', bedrooms: 2, areaM2: 58, windowDbIds: [win.dbId], doorDbIds: [door.dbId], roomDbIds: [] })
    expect(u.floorDbIds).toEqual(tipo1.map((f) => f.dbId))
    expect(occupantsOf(u)).toBe(3)
  })

  test('without Tipo comments, a room Number prefix names the unit and openings join the unit whose room they touch', () => {
    const rooms = [
      numbered('Habitación', '501-1', [0, 0, 4, 4]),
      numbered('Alcoba 2', '501-2', [4, 0, 8, 4]),
      numbered('Cocina', '501-3', [8, 0, 10, 4]),
      numbered('Habitación', '502-1', [0, 5, 4, 9]),
      numbered('Lobby', '12', [12, 0, 16, 4]),
    ]
    const south = window('L1', [1, 0], [2, 0])
    const north = window('L1', [1, 9], [2, 9])
    const units = deriveUnits(snapshotOf([...rooms, south, north], levels))
    expect(units.map((u) => [u.key, u.source, u.bedrooms, u.areaM2])).toEqual([
      ['501', 'room-number', 2, 16 + 16 + 8],
      ['502', 'room-number', 1, 16],
    ])
    expect(units[0].roomDbIds).toEqual(rooms.slice(0, 3).map((r) => r.dbId))
    expect(units[0].windowDbIds).toEqual([south.dbId])
    expect(units[1].windowDbIds).toEqual([north.dbId])
  })

  test('Department groups rooms per level when numbers carry no unit', () => {
    const units = deriveUnits(
      snapshotOf(
        [
          numbered('Habitación', '1', [0, 0, 4, 4], { Department: 'Apto 101' }),
          numbered('Sala', '2', [4, 0, 8, 4], { Department: 'Apto 101' }),
          numbered('Dormitorio', '3', [0, 5, 4, 9], { Department: 'Apto 102' }),
        ],
        levels,
      ),
    )
    expect(units.map((u) => [u.key, u.source, u.roomDbIds.length, u.bedrooms])).toEqual([
      ['L1 Apto 101', 'department', 2, 1],
      ['L1 Apto 102', 'department', 1, 1],
    ])
  })

  test('Revit Areas drawn per dwelling hold the rooms inside them and give the unit area', () => {
    const area = element('Revit Areas', 'Area / Dwelling', { level: 'L1', area: 45, bbox: [0, 0, 0, 8.2, 4.2, 3], params: { Name: 'Apto 201' } })
    const units = deriveUnits(snapshotOf([area, numbered('Habitación', '1', [0, 0, 4, 4]), numbered('Sala', '2', [4, 0, 8, 4]), numbered('Sala', '3', [20, 0, 24, 4])], levels))
    expect(units.map((u) => [u.key, u.source, u.roomDbIds.length, u.areaM2])).toEqual([['L1 Apto 201', 'areas', 2, 45]])
  })

  test('the first rule that finds a unit wins over the later ones', () => {
    const tagged = floor('Floor / Acabados Porcelanato Al.', 'L1', 12, 'Tipo 4')
    const units = deriveUnits(snapshotOf([tagged, numbered('Habitación', '501-1', [0, 0, 4, 4])], levels))
    expect(units.map((u) => [u.key, u.source])).toEqual([['L1 Tipo 4', 'comments-tipo']])
  })

  test('an office model has no dwelling units', () => {
    expect(deriveUnits(box().snapshot)).toEqual([])
  })
})

describe('dwellingSummary', () => {
  test('counts the units, names the rule and groups them by bedrooms, fewest first', () => {
    const tipo = (t: string, bedrooms: number) => [
      floor('Floor / Mortero de 0.05', 'L1', 50, t),
      ...Array.from({ length: bedrooms }, () => floor('Floor / Habitación', 'L1', 10, t)),
    ]
    const units = deriveUnits(snapshotOf([...tipo('Tipo 1', 2), ...tipo('Tipo 2', 1), ...tipo('Tipo 3', 2)], levels))
    expect(dwellingSummary(units)).toEqual({
      count: 3,
      source: 'comments-tipo',
      bedrooms: [
        { bedrooms: 1, units: 1 },
        { bedrooms: 2, units: 2 },
      ],
    })
  })

  test('no unit gives a zero count and no rule', () => {
    expect(dwellingSummary([])).toEqual({ count: 0, source: null, bedrooms: [] })
  })
})
