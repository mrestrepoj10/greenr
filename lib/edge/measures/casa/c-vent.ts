import { GUIDE } from '../../guide'
import type { Measure } from '../../types'
import { notImplemented } from './not-implemented'

export const C_VENT: Measure = {
  scheme: 'CASA',
  code: 'C-VENT',
  guide: GUIDE['C-VENT'],
  credits: ['SBp1', 'SBc6'],
  compute: () => notImplemented('C-VENT'),
}
