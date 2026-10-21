import { GUIDE } from '../../guide'
import type { Measure } from '../../types'
import { notImplemented } from './not-implemented'

export const C_FLEX: Measure = {
  scheme: 'CASA',
  code: 'C-FLEX',
  guide: GUIDE['C-FLEX'],
  credits: ['Mc4'],
  compute: () => notImplemented('C-FLEX'),
}
