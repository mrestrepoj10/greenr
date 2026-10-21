import { CASA_CREDITS } from '../guide'

export const FIXTURE_KINDS = ['lavatory', 'shower', 'kitchen', 'urinal', 'toilet'] as const
export type FixtureKind = (typeof FIXTURE_KINDS)[number]

export type FixtureCap = {
  label: string
  /** Matched against the family and type name, in `FIXTURE_KINDS` order. */
  name: RegExp
  cap: number
  unit: 'L/min' | 'L/flush'
  /** NTC 1500 test pressure for flow fittings. */
  testPsi: number | null
  params: readonly string[]
}

const FLOW = ['Flow', 'Flow Rate'] as const
const FLUSH = ['Flush'] as const

/** CASA Ap3 Tabla 28 restating NTC 1500: every fixture stays at or under its maximum. */
export const NTC_1500: Record<FixtureKind, FixtureCap> = {
  lavatory: { label: 'Lavamanos', name: /lavamanos|lavabo|lavatory|basin|vanity/i, cap: 8.3, unit: 'L/min', testPsi: 60, params: FLOW },
  shower: { label: 'Ducha', name: /ducha|shower/i, cap: 9.5, unit: 'L/min', testPsi: 80, params: FLOW },
  kitchen: { label: 'Grifería de cocina', name: /cocina|lavaplatos|fregadero|kitchen|sink/i, cap: 8.3, unit: 'L/min', testPsi: 60, params: FLOW },
  urinal: { label: 'Orinal', name: /orinal|urinal/i, cap: 3.8, unit: 'L/flush', testPsi: null, params: FLUSH },
  toilet: { label: 'Inodoro', name: /inodoro|sanitario|toilet|water ?closet|\bwc\b/i, cap: 6, unit: 'L/flush', testPsi: null, params: FLUSH },
}

export const NTC_1500_GUIDE = CASA_CREDITS['Ap3 Tabla 28']

export const fixtureKindOf = (name: string): FixtureKind | null => FIXTURE_KINDS.find((k) => NTC_1500[k].name.test(name)) ?? null
