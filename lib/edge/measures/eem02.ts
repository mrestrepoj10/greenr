import { GUIDE } from '../guide'
import { positive } from '../params'
import type { Element, Gap, Measure } from '../types'
import { buildingOf } from './building'
import { measureResult } from './result'

/** Parameter names that would carry a roof finish's solar reflectance. Revit has none by default. */
export const SRI_PARAMS = ['Solar Reflectance Index', 'SRI', 'Solar Reflectance', 'Reflectance']

export function groupByType(elements: Element[]): Map<string, Element[]> {
  const groups = new Map<string, Element[]>()
  for (const e of elements) groups.set(e.typeKey, [...(groups.get(e.typeKey) ?? []), e])
  return groups
}

export const EEM02: Measure = {
  scheme: 'EDGE',
  code: 'EEM02',
  guide: GUIDE.EEM02,
  credits: ['EEM02'],
  compute(snapshot, classifications, exclusions) {
    const b = buildingOf(snapshot, classifications, exclusions)
    const types = groupByType(b.roofs)
    const gaps: Gap[] = []
    for (const [typeKey, roofs] of types) {
      if (roofs.some((r) => SRI_PARAMS.some((name) => positive(r.params, name) !== null))) continue
      gaps.push({
        id: `EEM02:${typeKey}`,
        measure: 'EEM02',
        typeKey,
        dbIds: roofs.map((r) => r.dbId),
        missing: 'Solar Reflectance Index (SRI)',
        severity: 'blocks-claim',
        message: `No SRI or solar reflectance on ${typeKey}. EEM02 cannot be claimed without the manufacturer's SRI, unless the finish is white.`,
      })
    }
    return measureResult('EEM02', {
      inputs: [
        { label: 'Roof types', value: types.size, unit: 'types', source: 'parameter', dbIds: b.roofs.map((r) => r.dbId) },
        { label: 'Roof types with an SRI value', value: types.size - gaps.length, unit: 'types', source: 'parameter' },
      ],
      gaps,
      pendingTypeKeys: b.pendingTypeKeys,
      pendingExclusionIds: b.pendingExclusionIds,
    })
  },
}
