import type { MeasureCodeOf, MeasureResult } from '../../types'
import { measureResult } from '../result'

/** The registry and the panel carry every CASA measure before its computation lands; until then it reports blocked. */
export const notImplemented = (code: MeasureCodeOf<'CASA'>): MeasureResult =>
  measureResult(code, { inputs: [], blockedBy: [{ kind: 'not-implemented' }] })
