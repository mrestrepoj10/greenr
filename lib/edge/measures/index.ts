import type { Classification, Exclusion, Measure, MeasureCode, MeasureResult, ProjectInputs, Scheme, Snapshot } from '../types'
import { MEASURE_CODES, SCHEMES } from '../types'
import { AU_SKYLIGHT } from './au-skylight'
import { C_ENV } from './casa/c-env'
import { C_FLEX } from './casa/c-flex'
import { C_FLOOD } from './casa/c-flood'
import { C_GLAZE } from './casa/c-glaze'
import { C_SRI } from './casa/c-sri'
import { C_VENT } from './casa/c-vent'
import { C_WATER } from './casa/c-water'
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
  'C-ENV': C_ENV,
  'C-FLOOD': C_FLOOD,
  'C-VENT': C_VENT,
  'C-WATER': C_WATER,
  'C-FLEX': C_FLEX,
  'C-SRI': C_SRI,
  'C-GLAZE': C_GLAZE,
}

/** Only the selected schemes run, always in scheme order then registry order, whatever order the selection lists them. */
export function runMeasures(
  snapshot: Snapshot,
  classifications: Classification[],
  exclusions: Exclusion[],
  inputs: ProjectInputs,
  schemes: readonly Scheme[],
): MeasureResult[] {
  return SCHEMES.filter((s) => schemes.includes(s)).flatMap((s) =>
    MEASURE_CODES[s].map((code) => MEASURES[code].compute(snapshot, classifications, exclusions, inputs)),
  )
}
