import { GUIDE } from '../../guide'
import type { Measure } from '../../types'
import { notImplemented } from './not-implemented'

export const C_SRI: Measure = {
  scheme: 'CASA',
  code: 'C-SRI',
  guide: GUIDE['C-SRI'],
  credits: ['BEc3', 'MS&C §3'],
  compute: () => notImplemented('C-SRI'),
}
