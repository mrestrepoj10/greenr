import { RULES, reaches, type Threshold } from '../../casa/rules'
import { blockedOn } from '../../casa/scope'
import { GUIDE } from '../../guide'
import { param, positive } from '../../params'
import type { Element, Gap, Measure, MeasureFlag } from '../../types'
import { buildingOf } from '../building'
import { measureResult } from '../result'

export const C_SRI_LABELS = {
  types: 'Roof types',
  low: 'Roof area, slope 9.5° or less',
  steep: 'Roof area, slope above 9.5°',
  noSlope: 'Roof area with no Slope',
  above: 'Roof area with SRI above its slope threshold',
  share: 'Share of roof area with SRI above its slope threshold',
} as const

/** SRI proper; `Solar Reflectance` is a 0 to 1 reflectance, a different quantity. */
const SRI_NAMES = ['Solar Reflectance Index', 'SRI']

/** Revit stores roof slope as rise over run, and TORRE A reads 0, 0.05, 0.07 and 1 with no unit; a value with a degree sign is degrees. */
export function slopeDeg(e: Element): number | null {
  const raw = param(e.params, 'Slope')
  if (raw === null || raw === undefined || raw === '') return null
  const degrees = typeof raw === 'string' ? /^\s*(-?\d+(?:\.\d+)?)\s*°\s*$/.exec(raw) : null
  if (degrees) return Number(degrees[1])
  const rise = Number(raw)
  return Number.isFinite(rise) ? (Math.atan(Math.abs(rise)) * 180) / Math.PI : null
}

type SlopeClass = 'low' | 'steep'
const SRI_RULE: Record<SlopeClass, Threshold> = { low: RULES.lowRoofSri, steep: RULES.steepRoofSri }
const slopeClass = (deg: number): SlopeClass => (reaches(RULES.steepRoofDeg, deg) ? 'steep' : 'low')

/** BEc3: roofs count toward the 50% heat-island cover with SRI above 32 when steeper than 9.5°, above 64 otherwise. */
export const C_SRI: Measure = {
  scheme: 'CASA',
  code: 'C-SRI',
  guide: GUIDE['C-SRI'],
  credits: ['BEc3', 'MS&C §3'],
  compute(snapshot, classifications, exclusions) {
    const L = C_SRI_LABELS
    const b = buildingOf(snapshot, classifications, exclusions)
    const roofs = b.roofs.map((e) => {
      const deg = slopeDeg(e)
      const sri = SRI_NAMES.map((n) => positive(e.params, n)).find((v) => v !== null) ?? null
      const cls = deg === null ? null : slopeClass(deg)
      return { e, area: e.area ?? 0, cls, sri, above: cls !== null && sri !== null && reaches(SRI_RULE[cls], sri) }
    })
    const area = (list: typeof roofs) => list.reduce((s, r) => s + r.area, 0)
    const total = area(roofs)
    const above = roofs.filter((r) => r.above)

    const gaps: Gap[] = []
    const byType = new Map<string, typeof roofs>()
    for (const r of roofs) byType.set(r.e.typeKey, [...(byType.get(r.e.typeKey) ?? []), r])
    for (const [typeKey, list] of byType) {
      const dbIds = list.map((r) => r.e.dbId)
      if (list.every((r) => r.sri === null)) {
        gaps.push(blockedOn('C-SRI', 'Solar Reflectance Index', `${typeKey} has no SRI. BEc3 counts a roof only with the manufacturer's SRI.`, typeKey, dbIds))
      }
      if (list.some((r) => r.cls === null)) {
        gaps.push({
          id: `C-SRI:${typeKey}:slope`,
          measure: 'C-SRI',
          typeKey,
          dbIds: list.filter((r) => r.cls === null).map((r) => r.e.dbId),
          missing: 'Slope',
          severity: 'needs-data-sheet',
          message: `${typeKey} has no Slope, so neither the 9.5° low-slope nor the steep threshold can be picked.`,
        })
      }
    }

    const flags: MeasureFlag[] = (['low', 'steep'] as const).flatMap((cls) => {
      const short = [...new Set(roofs.filter((r) => r.cls === cls && r.sri !== null && !r.above).map((r) => `${r.e.typeKey} (SRI ${r.sri})`))]
      const rule = SRI_RULE[cls]
      return short.length
        ? [{ id: `C-SRI:${cls}`, level: 'flag' as const, threshold: rule.value, message: `${short.join(', ')}: BEc3 asks SRI above ${rule.value} on ${cls === 'low' ? 'roofs of 9.5° or less' : 'roofs steeper than 9.5°'}.`, guide: rule.guide }]
        : []
    })

    return measureResult('C-SRI', {
      inputs: [
        { label: L.types, value: byType.size, unit: 'types', source: 'parameter', dbIds: roofs.map((r) => r.e.dbId) },
        { label: L.low, value: area(roofs.filter((r) => r.cls === 'low')), unit: 'm²', source: 'parameter' },
        { label: L.steep, value: area(roofs.filter((r) => r.cls === 'steep')), unit: 'm²', source: 'parameter' },
        { label: L.noSlope, value: area(roofs.filter((r) => r.cls === null)), unit: 'm²', source: 'parameter' },
        { label: L.above, value: area(above), unit: 'm²', source: 'parameter', dbIds: above.map((r) => r.e.dbId) },
        { label: L.share, value: total > 0 ? area(above) / total : null, unit: 'ratio', source: 'parameter' },
      ],
      gaps,
      flags,
      pendingTypeKeys: b.pendingTypeKeys,
      pendingExclusionIds: b.pendingExclusionIds,
    })
  },
}
