import { glazingTypes, SHGC, U_PARAMS, VLT } from '../../casa/glazing'
import { RULES, reaches } from '../../casa/rules'
import { pendingFor, scopeOf } from '../../casa/scope'
import { GUIDE } from '../../guide'
import type { Gap, Measure, MeasureFlag } from '../../types'
import { measureResult } from '../result'

export const C_GLAZE_LABELS = {
  types: 'Glazing types',
  complete: 'Glazing types with U, SHGC and VT',
  lowVt: 'Glazing types with VT at or below 0.40',
} as const

export const C_GLAZE: Measure = {
  scheme: 'CASA',
  code: 'C-GLAZE',
  guide: GUIDE['C-GLAZE'],
  credits: ['SBc6', 'SBp3', 'Ep1', 'MS&C §3'],
  compute(snapshot, classifications, exclusions) {
    const scope = scopeOf(snapshot, classifications, exclusions)
    const { types, involved } = glazingTypes(scope)
    const gaps: Gap[] = []
    for (const t of types) {
      const missing = [t.u === null && U_PARAMS[0], t.shgc === null && SHGC, t.vt === null && VLT].filter((m): m is string => m !== false)
      if (missing.length === 0) continue
      gaps.push({
        id: `C-GLAZE:${t.typeKey}`,
        measure: 'C-GLAZE',
        typeKey: t.typeKey,
        dbIds: t.dbIds,
        missing: missing.join(', '),
        severity: 'needs-data-sheet',
        message: `${t.typeKey} has no ${missing.join(', ')} (zero counts as missing; U is read as ${U_PARAMS.join(' or ')}). SBp3 and Ep1 need U, SHGC and VT, SBc6 needs VT, and the MS&C form asks the glass U and SHGC.`,
      })
    }
    const lowVt = types.filter((t) => t.vt !== null && !reaches(RULES.glazingVlt, t.vt))
    const flags: MeasureFlag[] = lowVt.length
      ? [
          {
            id: 'C-GLAZE:vt',
            level: 'flag',
            threshold: RULES.glazingVlt.value,
            message: `${lowVt.map((t) => `${t.typeKey} (VT ${t.vt})`).join(', ')}: SBc6 Option 2 Alternative 1 asks VT above 0.40.`,
            guide: RULES.glazingVlt.guide,
          },
        ]
      : []
    return measureResult('C-GLAZE', {
      inputs: [
        { label: C_GLAZE_LABELS.types, value: types.length, unit: 'types', source: 'parameter', dbIds: types.flatMap((t) => t.dbIds) },
        { label: C_GLAZE_LABELS.complete, value: types.length - gaps.length, unit: 'types', source: 'parameter' },
        { label: C_GLAZE_LABELS.lowVt, value: lowVt.length, unit: 'types', source: 'parameter', dbIds: lowVt.flatMap((t) => t.dbIds) },
      ],
      gaps,
      flags,
      ...pendingFor(scope, involved),
    })
  },
}
