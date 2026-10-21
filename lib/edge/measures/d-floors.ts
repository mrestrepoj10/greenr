import { GUIDE } from '../guide'
import type { Measure } from '../types'
import { buildingOf } from './building'
import { measureResult } from './result'

export const D_FLOORS: Measure = {
  code: 'D-FLOORS',
  guide: GUIDE['D-FLOORS'],
  compute(snapshot, classifications, exclusions) {
    const b = buildingOf(snapshot, classifications, exclusions)
    const s = b.storeys
    return measureResult('D-FLOORS', {
      inputs: [
        { label: 'Floors above grade', value: s.above, unit: 'floors', source: 'rooms' },
        { label: 'Floors below grade', value: s.below, unit: 'floors', source: 'rooms' },
        { label: 'Floors above grade, area-weighted before rounding', value: s.aboveWeighted, unit: 'floors', source: 'rooms' },
        { label: 'Floors below grade, area-weighted before rounding', value: s.belowWeighted, unit: 'floors', source: 'rooms' },
        { label: 'Most floors above grade at one point', value: s.maxAbove, unit: 'floors', source: 'rooms' },
      ],
      pendingTypeKeys: b.pendingTypeKeys,
      pendingExclusionIds: b.pendingExclusionIds,
    })
  },
}
