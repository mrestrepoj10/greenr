import { describe, expect, test } from 'vitest'
import { missingGlazingData } from './measures/eem09'
import { param, positive } from './params'

describe('U-value under either Revit name', () => {
  test('TORRE A\'s "Thermal Transmittance (U)" answers a read of "Heat Transfer Coefficient (U)", group prefix and all', () => {
    const acristalado = { 'Analytical Properties::Thermal Transmittance (U)': 6.7069, 'Solar Heat Gain Coefficient': 0.86, 'Visual Light Transmittance': 0.9 }
    expect(positive(acristalado, 'Heat Transfer Coefficient (U)')).toBe(6.7069)
    expect(param(acristalado, 'Heat Transfer Coefficient (U)')).toBe(6.7069)
    expect(missingGlazingData(acristalado)).toEqual([])
  })

  test('the alias works both ways, and a zero under one name does not hide a value under the other', () => {
    expect(positive({ 'Heat Transfer Coefficient (U)': 2.1 }, 'Thermal Transmittance (U)')).toBe(2.1)
    expect(positive({ 'Heat Transfer Coefficient (U)': 0, 'Thermal Transmittance (U)': 3.4 }, 'Heat Transfer Coefficient (U)')).toBe(3.4)
  })

  test('a zero U under the new name is still a gap', () => {
    expect(missingGlazingData({ 'Thermal Transmittance (U)': 0, 'Solar Heat Gain Coefficient': 0.4, 'Visual Light Transmittance': 0.6 })).toEqual([
      'Heat Transfer Coefficient (U)',
    ])
  })
})
