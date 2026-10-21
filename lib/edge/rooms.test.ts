import { describe, expect, test } from 'vitest'
import { isBedroomName, isOutdoorRoomName, isUnplacedRoom, isWetRoomName, UNPLACED_PARAM } from './rooms'
import type { Element } from './types'

describe('room names', () => {
  test.each(['Habitación', 'Habitacion 2', 'Alcoba principal', 'Dormitorio', 'Cuarto', 'Bedroom 1'])('%s is a bedroom', (name) => {
    expect(isBedroomName(name)).toBe(true)
  })

  test.each(['Baño p', 'baño', 'Bano social', 'Ducha', 'Cocina', 'Lavandería', 'Patio de ropas', 'Cuarto de baño', 'Kitchen'])('%s is a wet room', (name) => {
    expect(isWetRoomName(name)).toBe(true)
  })

  test('a "cuarto de baño" is a bathroom, not a bedroom', () => {
    expect(isBedroomName('Cuarto de baño')).toBe(false)
  })

  test.each(['Balcón', 'Balcon', 'Terraza', 'Patio', 'Cubierta', 'Azotea', 'Jardín', 'Jardin', 'Roof Deck'])('%s is outdoors', (name) => {
    expect(isOutdoorRoomName(name)).toBe(true)
  })

  test.each(['Sala', 'Comedor', 'Estudio', 'Habitación', 'Closed'])('%s is indoors, not a wet room nor outdoors', (name) => {
    expect(isOutdoorRoomName(name)).toBe(false)
    expect(isWetRoomName(name)).toBe(false)
  })
})

test('isUnplacedRoom reads the flag the snapshot reader writes', () => {
  const room = (params: Element['params']): Element => ({ dbId: 1, typeKey: 'Revit Rooms', category: 'Revit Rooms', params })
  expect(isUnplacedRoom(room({ [UNPLACED_PARAM]: 1, Name: 'Habitación' }))).toBe(true)
  expect(isUnplacedRoom(room({ Name: 'Habitación' }))).toBe(false)
})
