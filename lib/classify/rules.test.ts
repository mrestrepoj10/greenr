import { describe, expect, test } from 'vitest'
import type { ElementRole } from '@/lib/edge/types'
import { classifyByRule, RULES } from './rules'
import { groupByType, indexByDbId } from './types-index'
import { FIXTURE_ELEMENTS } from './fixture'

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

describe('groupByType', () => {
  test('groups the two exterior wall rows under one type with both dbIds', () => {
    const group = groups.get('Basic Wall / Exterior - Brick on Block')!
    expect(group.dbIds).toEqual([1, 2])
    expect(group.category).toBe('Revit Walls')
    expect(group.sample.dbId).toBe(1)
  })
})
