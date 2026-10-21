import { GUIDE } from '../../guide'
import type { Measure } from '../../types'
import { notImplemented } from './not-implemented'

export const C_GLAZE: Measure = {
  scheme: 'CASA',
  code: 'C-GLAZE',
  guide: GUIDE['C-GLAZE'],
  credits: ['SBc6'],
  compute: () => notImplemented('C-GLAZE'),
}
