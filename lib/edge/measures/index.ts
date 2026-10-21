import type { Classification, Exclusion, Measure, MeasureCode, MeasureResult, Snapshot } from '../types'
import { MEASURE_CODES } from '../types'
import { AU_SKYLIGHT } from './au-skylight'
import { D_F2F } from './d-f2f'
import { D_FLOORS } from './d-floors'
import { D_GIA } from './d-gia'
import { D_ROOF } from './d-roof'
import { EEM01 } from './eem01'
import { EEM02 } from './eem02'
import { EEM09 } from './eem09'

export const MEASURES: Record<MeasureCode, Measure> = {
  'D-GIA': D_GIA,
  'D-FLOORS': D_FLOORS,
  'D-F2F': D_F2F,
  'D-ROOF': D_ROOF,
  EEM01,
  EEM02,
  EEM09,
  'AU-SKYLIGHT': AU_SKYLIGHT,
}

export function runMeasures(snapshot: Snapshot, classifications: Classification[], exclusions: Exclusion[]): MeasureResult[] {
  return MEASURE_CODES.map((code) => MEASURES[code].compute(snapshot, classifications, exclusions))
}
