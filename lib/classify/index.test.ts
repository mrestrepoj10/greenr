import { expect, test } from 'vitest'
import type { Classification } from '@/lib/edge/types'
import { classifySnapshot, toDecisionItem } from './index'
import { FIXTURE_SNAPSHOT } from './fixture'

test('classifySnapshot separates rule answers from leftovers', () => {
  const { byRule, leftovers, merged } = classifySnapshot(FIXTURE_SNAPSHOT, [])
  expect(byRule).toHaveLength(24)
  expect(leftovers.map((g) => g.typeKey).sort()).toEqual(['Basic Wall / Generic - 200mm', 'Cornice / Cornice Type 1'])
  expect(merged).toHaveLength(24)
  expect(merged.every((c) => c.source === 'rule')).toBe(true)
})

test('a user prior wins over a rule and fills a leftover', () => {
  const prior: Classification[] = [
    { typeKey: 'Basic Wall / Generic - Massing', role: 'exterior-wall', source: 'user', confidence: 1, reason: 'confirmed real wall' },
    { typeKey: 'Basic Wall / Generic - 200mm', role: 'interior-wall', source: 'user', confidence: 1, reason: 'confirmed partition' },
  ]
  const { byRule, leftovers, merged } = classifySnapshot(FIXTURE_SNAPSHOT, prior)
  const massing = merged.find((c) => c.typeKey === 'Basic Wall / Generic - Massing')!
  expect(massing.role).toBe('exterior-wall')
  expect(massing.source).toBe('user')
  expect(byRule.find((c) => c.typeKey === 'Basic Wall / Generic - Massing')!.role).toBe('massing')
  expect(leftovers.map((g) => g.typeKey)).toEqual(['Cornice / Cornice Type 1'])
  expect(merged.find((c) => c.typeKey === 'Basic Wall / Generic - 200mm')!.source).toBe('user')
})

test('a model prior fills a leftover but never overrides a rule', () => {
  const prior: Classification[] = [
    { typeKey: 'Cornice / Cornice Type 1', role: 'other', source: 'model', confidence: 0.8, reason: 'jev chose other' },
    { typeKey: 'Basic Wall / Generic - 200mm', role: 'other', source: 'model', confidence: 0, reason: 'decision model unavailable' },
    { typeKey: 'South Wall / 1200 x 1800mm', role: 'door', source: 'model', confidence: 0.9, reason: 'wrong' },
  ]
  const { leftovers, merged } = classifySnapshot(FIXTURE_SNAPSHOT, prior)
  expect(merged.find((c) => c.typeKey === 'Cornice / Cornice Type 1')!.source).toBe('model')
  expect(leftovers.map((g) => g.typeKey)).toEqual(['Basic Wall / Generic - 200mm'])
  expect(merged.find((c) => c.typeKey === 'South Wall / 1200 x 1800mm')!.role).toBe('window')
})

test('toDecisionItem carries the fields the decision model sees', () => {
  const { leftovers } = classifySnapshot(FIXTURE_SNAPSHOT)
  const item = toDecisionItem(leftovers.find((g) => g.typeKey === 'Basic Wall / Generic - 200mm')!)
  expect(item).toEqual({
    typeKey: 'Basic Wall / Generic - 200mm',
    category: 'Revit Walls',
    family: 'Basic Wall',
    typeName: 'Generic - 200mm',
    params: { Function: '' },
  })
})
