import { GUIDE } from '../guide'
import { positive, text } from '../params'
import type { Element, Gap, InputValue, Measure } from '../types'
import { tallyFacade } from './eem01'
import { measureResult } from './result'

export const GLAZING_PARAMS = {
  u: 'Heat Transfer Coefficient (U)',
  shgc: 'Solar Heat Gain Coefficient',
  vt: 'Visual Light Transmittance',
  r: 'Thermal Resistance (R)',
  construction: 'Analytic Construction',
} as const

/** Which of U, SHGC and VT a glazing type lacks. A zero counts as missing; R stands in for U when U is absent. */
export function missingGlazingData(params: Element['params']): string[] {
  const missing: string[] = []
  if (positive(params, GLAZING_PARAMS.u) === null && positive(params, GLAZING_PARAMS.r) === null) missing.push(GLAZING_PARAMS.u)
  if (positive(params, GLAZING_PARAMS.shgc) === null) missing.push(GLAZING_PARAMS.shgc)
  if (positive(params, GLAZING_PARAMS.vt) === null) missing.push(GLAZING_PARAMS.vt)
  return missing
}

/** EEM09 glass must match the EEM01 glazing, so the types are the ones EEM01 counted. */
export const EEM09: Measure = {
  code: 'EEM09',
  guide: GUIDE.EEM09,
  compute(snapshot, classifications, exclusions) {
    const tally = tallyFacade(snapshot, classifications, exclusions)
    const byDbId = new Map(snapshot.elements.map((e) => [e.dbId, e]))
    const types = new Map<string, { dbIds: number[]; areaM2: number }>()
    for (const g of tally.glazing) {
      const t = types.get(g.typeKey) ?? { dbIds: [], areaM2: 0 }
      t.dbIds.push(g.dbId)
      t.areaM2 += g.areaM2
      types.set(g.typeKey, t)
    }
    const gaps: Gap[] = []
    const inputs: InputValue[] = []
    for (const [typeKey, t] of [...types].sort((a, b) => b[1].areaM2 - a[1].areaM2)) {
      inputs.push({ label: `Glazing area: ${typeKey}`, value: t.areaM2, unit: 'm²', source: 'parameter', dbIds: t.dbIds })
      const sample = byDbId.get(t.dbIds[0])!
      const missing = missingGlazingData(sample.params)
      if (missing.length === 0) continue
      const construction = text(sample.params, GLAZING_PARAMS.construction)
      gaps.push({
        id: `EEM09:${typeKey}`,
        measure: 'EEM09',
        typeKey,
        dbIds: t.dbIds,
        missing: missing.join(', '),
        severity: 'needs-data-sheet',
        message: `${typeKey} has no ${missing.join(', ')} (zero counts as missing)${construction ? `; Analytic Construction is "${construction}"` : ''}. EEM09 needs centre-of-glass U, SHGC and VT from the manufacturer's data sheet.`,
      })
    }
    return measureResult('EEM09', {
      inputs,
      gaps,
      pendingTypeKeys: tally.pendingTypeKeys,
      pendingExclusionIds: tally.pendingExclusionIds,
    })
  },
}
