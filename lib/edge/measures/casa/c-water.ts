import { GUIDE } from '../../guide'
import type { Measure } from '../../types'
import { notImplemented } from './not-implemented'

export const C_WATER: Measure = {
  scheme: 'CASA',
  code: 'C-WATER',
  guide: GUIDE['C-WATER'],
  credits: ['Ap3', 'MS&C §3'],
  compute: () => notImplemented('C-WATER'),
}
