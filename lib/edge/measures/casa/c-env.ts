import { GUIDE } from '../../guide'
import type { Measure } from '../../types'
import { notImplemented } from './not-implemented'

export const C_ENV: Measure = {
  scheme: 'CASA',
  code: 'C-ENV',
  guide: GUIDE['C-ENV'],
  credits: ['GGc5', 'SBp3', 'Ep1', 'MS&C §2'],
  compute: () => notImplemented('C-ENV'),
}
