import { applyExclusions } from '../exclusions'
import { GUIDE, SKYLIGHT_AUDIT_GUIDE } from '../guide'
import { pendingOf, roleIndex } from '../roles'
import type { Element, Measure, MeasureFlag } from '../types'
import { buildingOf } from './building'
import { roofAreaM2 } from './d-roof'
import { measureResult } from './result'

/** Part 3 (2026-09) makes EEM25 mandatory at 1% of roof area; Part 8's audit checklist still says more than 5%. Both are reported. */
export const SKYLIGHT_FLAG_SHARE = 0.01
export const SKYLIGHT_MANDATORY_SHARE = 0.05

function skylightArea(e: Element): number {
  if (e.width && e.height) return e.width * e.height
  if (e.area) return e.area
  const b = e.bbox
  return b ? (b[3] - b[0]) * (b[4] - b[1]) : 0
}

export const AU_SKYLIGHT: Measure = {
  code: 'AU-SKYLIGHT',
  guide: GUIDE['AU-SKYLIGHT'],
  compute(snapshot, classifications, exclusions) {
    const b = buildingOf(snapshot, classifications, exclusions)
    const roles = roleIndex(classifications)
    const removed = applyExclusions(exclusions, ['user']).removed
    const skylights = snapshot.elements.filter((e) => roles.roleOf(e) === 'skylight' && !removed.has(e.dbId))
    const sky = skylights.reduce((s, e) => s + skylightArea(e), 0)
    const roof = roofAreaM2(b.roofs)
    const share = roof > 0 ? sky / roof : null
    const flags: MeasureFlag[] = []
    if (share !== null && share >= SKYLIGHT_FLAG_SHARE) {
      flags.push({
        id: 'AU-SKYLIGHT:part3-1pct',
        level: 'flag',
        threshold: SKYLIGHT_FLAG_SHARE,
        message: 'Skylights cover 1% or more of the roof area: EEM25 Skylights is mandatory under Part 3 (except apartments).',
        guide: GUIDE['AU-SKYLIGHT'],
      })
    }
    if (share !== null && share > SKYLIGHT_MANDATORY_SHARE) {
      flags.push({
        id: 'AU-SKYLIGHT:part8-5pct',
        level: 'mandatory',
        threshold: SKYLIGHT_MANDATORY_SHARE,
        message: 'Skylights cover more than 5% of the aggregate roof area: the Part 8 site audit requires EEM25 to be claimed.',
        guide: SKYLIGHT_AUDIT_GUIDE,
      })
    }
    return measureResult('AU-SKYLIGHT', {
      inputs: [
        { label: 'Skylight area', value: sky, unit: 'm²', source: 'parameter', dbIds: skylights.map((e) => e.dbId) },
        { label: 'Aggregate roof area', value: roof, unit: 'm²', source: 'parameter', dbIds: b.roofs.map((e) => e.dbId) },
        { label: 'Skylight share of roof area', value: share, unit: 'ratio', source: 'mixed' },
      ],
      flags,
      pendingTypeKeys: pendingOf(
        [...snapshot.elements.filter((e) => /Windows/.test(e.category)).map((e) => e.typeKey), ...b.pendingTypeKeys],
        roles,
      ),
      pendingExclusionIds: b.pendingExclusionIds,
    })
  },
}
