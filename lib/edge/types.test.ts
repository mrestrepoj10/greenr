import { expect, test } from 'vitest'
import { ORIENTATIONS } from './types'

test('eight orientations in clockwise order', () => {
  expect(ORIENTATIONS).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
})
