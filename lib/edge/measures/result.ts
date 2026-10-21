import { GUIDE } from '../guide'
import type { MeasureCode, MeasureResult } from '../types'

type Parts = Omit<MeasureResult, 'code' | 'guide' | 'state' | 'gaps' | 'pendingTypeKeys'> &
  Partial<Pick<MeasureResult, 'gaps' | 'pendingTypeKeys'>>

export function measureResult(code: MeasureCode, parts: Parts): MeasureResult {
  const gaps = parts.gaps ?? []
  const pendingTypeKeys = parts.pendingTypeKeys ?? []
  const pending = pendingTypeKeys.length > 0 || (parts.pendingExclusionIds?.length ?? 0) > 0
  const state = gaps.some((g) => g.severity === 'blocks-claim') ? 'blocked' : pending ? 'provisional' : 'ok'
  return { ...parts, code, guide: GUIDE[code], state, gaps, pendingTypeKeys }
}
