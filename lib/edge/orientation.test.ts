import { describe, expect, test } from 'vitest'
import { azimuthOf, binAzimuth } from './orientation'

describe('azimuthOf', () => {
  test.each([
    [[0, 1], 0],
    [[1, 0], 90],
    [[0, -1], 180],
    [[-1, 0], 270],
    [[1, 1], 45],
  ])('direction %j points %d degrees clockwise from north', (direction, az) => {
    expect(azimuthOf(direction)).toBeCloseTo(az, 9)
  })
})

describe('binAzimuth', () => {
  test.each([
    [0, 'N'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SW'],
    [270, 'W'],
    [315, 'NW'],
  ])('%d degrees is %s', (az, bin) => {
    expect(binAzimuth(az)).toBe(bin)
  })

  test('sector edges: the lower edge belongs to the sector, the upper edge to the next one clockwise', () => {
    expect(binAzimuth(337.5)).toBe('N')
    expect(binAzimuth(-22.5)).toBe('N')
    expect(binAzimuth(22.4999)).toBe('N')
    expect(binAzimuth(22.5)).toBe('NE')
    expect(binAzimuth(337.4999)).toBe('NW')
    expect(binAzimuth(67.5)).toBe('E')
    expect(binAzimuth(359.9999)).toBe('N')
    expect(binAzimuth(360)).toBe('N')
  })

  test('a true north offset rotates every façade the other way', () => {
    expect(binAzimuth(0, 17)).toBe('N')
    expect(binAzimuth(0, 30)).toBe('NW')
    expect(binAzimuth(180, 90)).toBe('E')
    expect(binAzimuth(90, -45)).toBe('SE')
    expect(binAzimuth(52.5, 30)).toBe('NE')
    expect(binAzimuth(52.4999, 30)).toBe('N')
  })
})
