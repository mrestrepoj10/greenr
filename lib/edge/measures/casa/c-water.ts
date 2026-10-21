import { FIXTURE_KINDS, fixtureKindOf, NTC_1500, NTC_1500_GUIDE, type FixtureKind } from '../../casa/ntc1500'
import { pendingFor, scopeOf, select, typeGap } from '../../casa/scope'
import { GUIDE } from '../../guide'
import { positive } from '../../params'
import type { Element, Gap, InputValue, Measure, MeasureBlocker, MeasureFlag } from '../../types'
import { deriveUnits, occupantsOf } from '../../units'
import { labelFamily, type LabelFamily } from '../labels'
import { measureResult } from '../result'

export const C_WATER_LABELS = {
  fixtures: 'Plumbing fixtures',
  units: 'Dwelling units',
  occupants: 'Occupants, bedrooms plus one per unit',
} as const

/** One input per fixture type NTC 1500 caps: its flow or flush, null when the type carries no parameter for it. */
export const FIXTURE_ROWS = Object.fromEntries(FIXTURE_KINDS.map((k) => [k, labelFamily(`${NTC_1500[k].label}: `)])) as Record<FixtureKind, LabelFamily>

/** The worst fixture of a kind, the value the MS&C form asks per fixture kind. */
export const highestLabel = (kind: FixtureKind): string => `Highest ${NTC_1500[kind].unit === 'L/min' ? 'flow' : 'flush'}, ${NTC_1500[kind].label}`

/** No real lavatory or shower runs under 1 L/min; a smaller reading is most likely in L/s. */
const MIN_PLAUSIBLE_L_PER_MIN = 1

/** Ap3: every fixture at or under its NTC 1500 maximum (Tabla 28). Values and gaps only; the CASA water calculator computes the saving. */
export const C_WATER: Measure = {
  scheme: 'CASA',
  code: 'C-WATER',
  guide: GUIDE['C-WATER'],
  credits: ['Ap3', 'MS&C §3'],
  compute(snapshot, classifications, exclusions) {
    const scope = scopeOf(snapshot, classifications, exclusions)
    const fixtures = select(scope, ['plumbing-fixture'], /Plumbing Fixtures/)
    const byType = new Map<string, Element[]>()
    for (const f of fixtures.used) byType.set(f.typeKey, [...(byType.get(f.typeKey) ?? []), f])

    const inputs: InputValue[] = [{ label: C_WATER_LABELS.fixtures, value: fixtures.used.length, unit: 'fixtures', source: 'parameter', dbIds: fixtures.used.map((f) => f.dbId) }]
    const gaps: Gap[] = []
    const blockedBy: MeasureBlocker[] = []
    const highest = new Map<FixtureKind, { value: number; dbIds: number[] }>()
    const over = new Map<FixtureKind, string[]>()
    if (fixtures.used.length === 0) blockedBy.push({ kind: 'missing-elements', elements: 'plumbing-fixture' })

    for (const [typeKey, list] of [...byType].sort((a, b) => a[0].localeCompare(b[0]))) {
      const dbIds = list.map((f) => f.dbId)
      const kind = fixtureKindOf(typeKey)
      if (!kind) {
        gaps.push({
          id: `C-WATER:${typeKey}`,
          measure: 'C-WATER',
          typeKey,
          dbIds,
          missing: 'Fixture kind',
          severity: 'info',
          message: `${typeKey} matches no NTC 1500 fixture (lavamanos, ducha, grifería de cocina, orinal, inodoro), so it is not checked.`,
        })
        continue
      }
      const cap = NTC_1500[kind]
      const value = cap.params.map((name) => positive(list[0].params, name)).find((v) => v !== null) ?? null
      inputs.push({ label: FIXTURE_ROWS[kind].of(typeKey), value, unit: cap.unit, source: 'parameter', dbIds })
      if (value === null) {
        const pressure = cap.testPsi ? ` at ${cap.testPsi} psi` : ''
        const parameter = cap.params.join(' or ')
        blockedBy.push({ kind: 'missing-parameter', parameter })
        gaps.push(
          typeGap(
            'C-WATER',
            parameter,
            `${list.length} × ${typeKey} (${cap.label}) carry no ${parameter}. Ap3 needs each fixture's ${cap.unit}${pressure} from its data sheet.`,
            typeKey,
            dbIds,
          ),
        )
        continue
      }
      if (cap.unit === 'L/min' && value < MIN_PLAUSIBLE_L_PER_MIN) {
        gaps.push({
          id: `C-WATER:${typeKey}:unit`,
          measure: 'C-WATER',
          typeKey,
          dbIds,
          missing: cap.params.join(' or '),
          severity: 'needs-data-sheet',
          message: `${typeKey} reads ${value} L/min, which looks like L/s. Confirm the unit against the data sheet.`,
        })
      }
      const top = highest.get(kind)
      if (!top || value > top.value) highest.set(kind, { value, dbIds })
      if (value > cap.cap) over.set(kind, [...(over.get(kind) ?? []), `${typeKey} (${value} ${cap.unit})`])
    }

    for (const [kind, top] of highest) inputs.push({ label: highestLabel(kind), value: top.value, unit: NTC_1500[kind].unit, source: 'parameter', dbIds: top.dbIds })

    const units = deriveUnits(snapshot)
    if (units.length) {
      inputs.push(
        { label: C_WATER_LABELS.units, value: units.length, unit: 'units', source: 'mixed' },
        { label: C_WATER_LABELS.occupants, value: units.reduce((s, u) => s + occupantsOf(u), 0), unit: 'people', source: 'mixed' },
      )
    } else {
      gaps.push({
        id: 'C-WATER:units',
        measure: 'C-WATER',
        typeKey: '',
        dbIds: [],
        missing: 'Dwelling units',
        severity: 'info',
        message: 'No dwelling unit found, so the occupants the CASA water calculator takes (bedrooms plus one per unit) are not counted.',
      })
    }

    const flags: MeasureFlag[] = [...over].map(([kind, types]) => ({
      id: `C-WATER:${kind}`,
      level: 'flag',
      threshold: NTC_1500[kind].cap,
      message: `${types.join(', ')}: above the NTC 1500 maximum of ${NTC_1500[kind].cap} ${NTC_1500[kind].unit} for ${NTC_1500[kind].label}.`,
      guide: NTC_1500_GUIDE,
    }))

    return measureResult('C-WATER', { inputs, gaps, flags, blockedBy, ...pendingFor(scope, fixtures.involved) })
  },
}
