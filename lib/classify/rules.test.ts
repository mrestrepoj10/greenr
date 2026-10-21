import { describe, expect, test } from 'vitest'
import type { ElementRole } from '@/lib/edge/types'
import { classifyByRule, RULES } from './rules'
import { groupByType, indexByDbId } from './types-index'
import { FIXTURE_ELEMENTS } from './fixture'
import type { Element } from '@/lib/edge/types'

const byDbId = indexByDbId(FIXTURE_ELEMENTS)
const groups = groupByType(FIXTURE_ELEMENTS)

const classify = (typeKey: string) => {
  const group = groups.get(typeKey)
  if (!group) throw new Error(`no fixture type ${typeKey}`)
  return classifyByRule(group.dbIds.map((dbId) => byDbId.get(dbId)!), byDbId)
}

const expected: [typeKey: string, role: ElementRole, reason: RegExp][] = [
  ['Basic Wall / Exterior - Brick on Block', 'exterior-wall', /Function = Exterior/],
  ['Basic Wall / Interior - Partition', 'interior-wall', /Function = Interior/],
  ['Basic Wall / Shaft Wall', 'interior-wall', /Core-shaft/],
  ['Basic Wall / Generic - Massing', 'massing', /massing/],
  ['Massing_Wall / Massing_Wall', 'massing', /massing/],
  ['Basic Wall / Parapet - 200mm', 'parapet', /parapet/],
  ['Basic Wall / Foundation - 300mm Concrete', 'exterior-wall', /Foundation/],
  ['Curtain Wall / System Panel / Glazed', 'curtain-glazed', /glazing/],
  ['System Panel / Glazed CENTER', 'curtain-glazed', /glazing/],
  ['CW_SYS_PNL_WINDOW / CW_SYS_PNL_WINDOW', 'curtain-glazed', /glazing/],
  ['System Panel / Spandrel - Aluminium', 'curtain-solid', /opaque/],
  ['Curtain Wall / Solid Wood Panel', 'curtain-solid', /opaque/],
  ['Rectangular Mullion / 50 x 150mm', 'other', /mullion/],
  ['South Wall / 1200 x 1800mm', 'window', /Windows category/],
  ['Velux / Skylight 780 x 1400', 'skylight', /skylight/],
  ['Roof Window / Fixed 1000 x 1000', 'skylight', /hosted in a roof/],
  ['Single-Flush / 915 x 2134mm', 'door', /Doors/],
  ['Basic Roof / Warm Roof - Concrete', 'roof', /Roofs/],
  ['Floor / Concrete 200mm', 'floor', /Floors/],
  ['Room / Room', 'room', /Rooms/],
  ['SHADE SUPPORT / SHADE SUPPORT', 'shading', /shading/],
  ['Horizontal Louvre / Louvre 300', 'shading', /shading/],
  ['Concrete Column / 400 x 400', 'other', /outside the building envelope/],
  ['Desk / 1800 x 900', 'other', /outside the building envelope/],
]

describe('classifyByRule', () => {
  test.each(expected)('%s -> %s', (typeKey, role, reason) => {
    const result = classify(typeKey)
    expect(result).not.toBeNull()
    expect(result!.role).toBe(role)
    expect(result!.reason).toMatch(reason)
    expect(result!.source).toBe('rule')
    expect(result!.confidence).toBe(1)
    expect(result!.typeKey).toBe(typeKey)
  })

  test('a basic wall with no Function and a generic model with no shading name are leftovers', () => {
    expect(classify('Basic Wall / Generic - 200mm')).toBeNull()
    expect(classify('Cornice / Cornice Type 1')).toBeNull()
  })

  test('massing wins over Function = Exterior because the table lists it first', () => {
    const massing = RULES.findIndex((r) => r.role === 'massing')
    const exterior = RULES.findIndex((r) => r.role === 'exterior-wall')
    expect(massing).toBeLessThan(exterior)
  })

  test('an empty type is a leftover', () => {
    expect(classifyByRule([])).toBeNull()
  })

  test('the rule table reaches every role except the two that only a person or model can assign', () => {
    const roles = new Set(RULES.map((r) => r.role))
    for (const role of ['exterior-wall', 'interior-wall', 'massing', 'parapet', 'window', 'curtain-glazed', 'curtain-solid', 'door', 'skylight', 'roof', 'floor', 'room', 'shading', 'other']) {
      expect(roles.has(role as ElementRole)).toBe(true)
    }
  })
})

describe('building services and site categories', () => {
  const cases: [category: string, role: ElementRole][] = [
    ['Revit Plumbing Fixtures', 'plumbing-fixture'],
    ['Revit Lighting Fixtures', 'lighting-fixture'],
    ['Revit Mechanical Equipment', 'equipment'],
    ['Revit Electrical Equipment', 'equipment'],
    ['Revit Specialty Equipment', 'equipment'],
    ['Revit Electrical Fixtures', 'equipment'],
    ['Revit Parking', 'parking'],
    ['Revit Planting', 'planting'],
    ['Revit Areas', 'area'],
    ['Revit Pipes', 'pipe'],
    ['Revit Piping Systems', 'pipe'],
    ['Revit Pipe Accessories', 'pipe'],
    ['Revit Pipe Fittings', 'other'],
    ['Revit Lighting Devices', 'other'],
  ]
  test.each(cases)('%s -> %s', (category, role) => {
    const element: Element = { dbId: 1, typeKey: 'MezcladorDucha / Tipo 1', category, family: 'MezcladorDucha', typeName: 'Tipo 1', params: {} }
    expect(classifyByRule([element])?.role).toBe(role)
  })
})

describe('groupByType', () => {
  test('groups the two exterior wall rows under one type with both dbIds', () => {
    const group = groups.get('Basic Wall / Exterior - Brick on Block')!
    expect(group.dbIds).toEqual([1, 2])
    expect(group.category).toBe('Revit Walls')
    expect(group.sample.dbId).toBe(1)
  })
})

describe('Spanish Revit names', () => {
  const spanish = (category: string, family: string, typeName: string, params: Element['params'] = {}, hostDbId?: number): Element => ({
    dbId: 1,
    typeKey: `${family} / ${typeName}`,
    category,
    family,
    typeName,
    params,
    ...(hostDbId === undefined ? {} : { hostDbId }),
  })
  const roleOf = (e: Element) => classifyByRule([e])?.role ?? null

  const cases: [Element, ElementRole][] = [
    [spanish('Revit Walls', 'Muro básico', 'Fachada - Ladrillo', { Function: 'Exterior' }), 'exterior-wall'],
    [spanish('Revit Walls', 'Muro básico', 'Tabique - Drywall', { Function: 'INTERIOR' }), 'interior-wall'],
    [spanish('Revit Walls', 'Muro básico', 'Fachada', { 'Construcción::Function': 'exterior' }), 'exterior-wall'],
    [spanish('Revit Curtain Panels', 'Panel de sistema', 'Vidrio templado'), 'curtain-glazed'],
    [spanish('Revit Curtain Panels', 'Panel de sistema', 'Acristalado'), 'curtain-glazed'],
    [spanish('Revit Curtain Panels', 'Panel de ventana', 'Proyectante'), 'curtain-glazed'],
    [spanish('Revit Curtain Panels', 'Panel de sistema', 'Vidriado'), 'curtain-glazed'],
    [spanish('Revit Walls', 'Panel de sistema', 'Acristalado'), 'curtain-glazed'],
    [spanish('Revit Doors', 'Puerta corrediza con dos hojas', 'Vidrio 2.40', { Function: 'Interior' }), 'door'],
    [spanish('Revit Walls', 'Muro cortina', 'Fachada Cristal'), 'curtain-glazed'],
    [spanish('Revit Walls', 'Muro cortina', 'Panel aluminio compuesto'), 'curtain-solid'],
    [spanish('Revit Windows', 'Claraboya', 'Fija 900 x 900'), 'skylight'],
    [spanish('Revit Windows', 'Ventana corrediza', 'Tragaluz 600'), 'skylight'],
    [spanish('Revit Windows', 'Ventana corrediza', '1200 x 1500'), 'window'],
    [spanish('Revit Walls', 'Muro básico', 'Masa_Contexto', { Function: 'Exterior' }), 'massing'],
    [spanish('Revit Walls', 'Masing', 'Vecino', { Function: 'Exterior' }), 'massing'],
    [spanish('Revit Walls', 'Muro básico', 'Antepecho 1.10', { Function: 'Exterior' }), 'parapet'],
    [spanish('Revit Walls', 'Muro básico', 'Pretil cubierta', { Function: 'Exterior' }), 'parapet'],
    [spanish('Revit Generic Models', 'Persiana', 'Horizontal 150'), 'shading'],
    [spanish('Revit Generic Models', 'Celosía', 'Madera'), 'shading'],
    [spanish('Revit Generic Models', 'Celosia', 'Concreto'), 'shading'],
    [spanish('Revit Generic Models', 'Parasol', 'Vertical'), 'shading'],
    [spanish('Revit Generic Models', 'Brise soleil', 'Aluminio'), 'shading'],
  ]

  test.each(cases.map(([element, role]) => [element.typeKey, role, element] as const))('%s -> %s', (_, role, element) => {
    expect(roleOf(element)).toBe(role)
  })

  test.each([
    ['Revit Curtain Panels', 'Panel de sistema', 'aire'],
    ['Revit Curtain Panels', 'Panel de sistema', 'Vacío'],
    ['Revit Curtain Panels', 'System Panel', 'Empty'],
    ['Revit Walls', 'Muro cortina', 'Panel vacio'],
  ])('%s %s / %s is an empty panel: no glazing and no opaque façade', (category, family, typeName) => {
    const result = classifyByRule([spanish(category, family, typeName)])
    expect(result?.role).toBe('other')
    expect(result?.reason).toBe('empty panel')
  })

  test('"aire" needs word edges, so a glazed panel named after a brand is still glazing', () => {
    expect(roleOf(spanish('Revit Curtain Panels', 'Panel de sistema', 'Vidrio Airelux'))).toBe('curtain-glazed')
  })

  test('a Spanish wall with no Function and no telling name stays a leftover', () => {
    expect(roleOf(spanish('Revit Walls', 'Muro básico', 'Genérico - 200 mm'))).toBeNull()
  })

  test('"masa" needs a word start, so a name that only contains it is not massing', () => {
    expect(roleOf(spanish('Revit Walls', 'Muro básico', 'Carcamasa', { Function: 'Exterior' }))).toBe('exterior-wall')
  })
})
