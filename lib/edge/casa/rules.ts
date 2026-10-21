import { CASA_CREDITS } from '../guide'
import type { GuideRef } from '../types'

/** A CASA number a measured value is compared with. `inclusive` follows the wording: "mínimo" includes the value, "mayor a" does not. */
export type Threshold = { value: number; unit: string; inclusive: boolean; guide: GuideRef }

export const RULES = {
  ventOpeningShare: { value: 0.04, unit: 'ratio', inclusive: false, guide: CASA_CREDITS.SBp1 },
  unitGlazingShare: { value: 0.15, unit: 'ratio', inclusive: true, guide: CASA_CREDITS.SBc6 },
  glazingVlt: { value: 0.4, unit: 'ratio', inclusive: false, guide: CASA_CREDITS.SBc6 },
  nonStructuralShare: { value: 0.5, unit: 'ratio', inclusive: false, guide: CASA_CREDITS.Mc4 },
  slabToSlabM: { value: 2.4, unit: 'm', inclusive: true, guide: CASA_CREDITS.Mc4 },
  steepRoofDeg: { value: 9.5, unit: '°', inclusive: false, guide: CASA_CREDITS.BEc3 },
  steepRoofSri: { value: 32, unit: 'SRI', inclusive: false, guide: CASA_CREDITS.BEc3 },
  lowRoofSri: { value: 64, unit: 'SRI', inclusive: false, guide: CASA_CREDITS.BEc3 },
  floodplainReturnYears: { value: 100, unit: 'years', inclusive: true, guide: CASA_CREDITS.CCRc4 },
} as const satisfies Record<string, Threshold>

export const reaches = (rule: Threshold, value: number): boolean => (rule.inclusive ? value >= rule.value : value > rule.value)
