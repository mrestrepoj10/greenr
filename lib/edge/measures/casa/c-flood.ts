import { GUIDE } from '../../guide'
import type { Measure } from '../../types'
import { notImplemented } from './not-implemented'

export const C_FLOOD: Measure = {
  scheme: 'CASA',
  code: 'C-FLOOD',
  guide: GUIDE['C-FLOOD'],
  credits: ['CCRp3', 'CCRc4'],
  compute: () => notImplemented('C-FLOOD'),
}
