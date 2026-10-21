import { GUIDE } from '../guide'
import type { Measure } from '../types'
import { buildingOf } from './building'
import { measureResult } from './result'

export const D_F2F: Measure = {
  scheme: 'EDGE',
  code: 'D-F2F',
  guide: GUIDE['D-F2F'],
  credits: ['Design tab'],
  compute(snapshot, classifications, exclusions) {
    const b = buildingOf(snapshot, classifications, exclusions)
    return measureResult('D-F2F', {
      inputs: [
        {
          label: 'Floor-to-floor height, area-weighted over rooms',
          value: b.ff.averageM,
          unit: 'm',
          source: 'mixed',
          dbIds: [...b.ff.byRoom.keys()],
        },
        { label: 'Rooms with a slab found above', value: b.ff.roomsMeasured, unit: 'rooms', source: 'rooms' },
      ],
      pendingTypeKeys: b.pendingTypeKeys,
      pendingExclusionIds: b.pendingExclusionIds,
    })
  },
}
