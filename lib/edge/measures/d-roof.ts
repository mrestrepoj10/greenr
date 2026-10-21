import { GUIDE } from '../guide'
import type { Measure } from '../types'
import { buildingOf } from './building'
import { measureResult } from './result'

export function roofAreaM2(roofs: { area?: number }[]): number {
  return roofs.reduce((s, e) => s + (e.area ?? 0), 0)
}

export const D_ROOF: Measure = {
  scheme: 'EDGE',
  code: 'D-ROOF',
  guide: GUIDE['D-ROOF'],
  credits: ['Design tab'],
  compute(snapshot, classifications, exclusions) {
    const b = buildingOf(snapshot, classifications, exclusions)
    return measureResult('D-ROOF', {
      inputs: [
        {
          label: 'Aggregate roof area, sum of roof elements',
          value: roofAreaM2(b.roofs),
          unit: 'm²',
          source: 'parameter',
          dbIds: b.roofs.map((e) => e.dbId),
        },
        { label: 'Cross-check: plan area covered by indoor rooms', value: b.storeys.footprintM2, unit: 'm²', source: 'geometry' },
      ],
      pendingTypeKeys: b.pendingTypeKeys,
      pendingExclusionIds: b.pendingExclusionIds,
    })
  },
}
