import { applyExclusions } from '../exclusions'
import { GUIDE } from '../guide'
import { roleIndex } from '../roles'
import { roomIndexOf } from '../rooms'
import type { Measure } from '../types'
import { measureResult } from './result'

/** IPMS 2 GIA includes unconditioned areas, so only massing and user exclusions apply. Outdoor rooms never enter the room index. */
export const D_GIA: Measure = {
  code: 'D-GIA',
  guide: GUIDE['D-GIA'],
  compute(snapshot, classifications, exclusions) {
    const applied = applyExclusions(exclusions, ['massing', 'user'])
    const rooms = roomIndexOf(snapshot).rooms.filter((r) => !applied.removed.has(r.dbId))
    const roles = roleIndex(classifications)
    const floors = snapshot.elements.filter((e) => roles.roleOf(e) === 'floor' && !applied.removed.has(e.dbId))
    return measureResult('D-GIA', {
      inputs: [
        {
          label: 'Gross internal area, sum of indoor rooms',
          value: rooms.reduce((s, r) => s + r.areaM2, 0),
          unit: 'm²',
          source: 'rooms',
          dbIds: rooms.map((r) => r.dbId),
        },
        {
          label: 'Cross-check: sum of floor slab areas',
          value: floors.reduce((s, e) => s + (e.area ?? 0), 0),
          unit: 'm²',
          source: 'parameter',
          dbIds: floors.map((e) => e.dbId),
        },
      ],
    })
  },
}
