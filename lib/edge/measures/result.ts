import { GUIDE } from '../guide'
import type { MeasureBlocker, MeasureCode, MeasureResult } from '../types'

type Parts = Omit<MeasureResult, 'code' | 'guide' | 'state' | 'gaps' | 'pendingTypeKeys'> &
  Partial<Pick<MeasureResult, 'gaps' | 'pendingTypeKeys'>>

/** One blocker per reason: ten fixture types missing Flow block once. An empty list is no blocker at all. */
function uniqueBlockers(list: MeasureBlocker[] | undefined): MeasureBlocker[] | undefined {
  if (!list?.length) return undefined
  return [...new Map(list.map((b) => [JSON.stringify(b), b])).values()]
}

export function measureResult(code: MeasureCode, { blockedBy: listed, ...parts }: Parts): MeasureResult {
  const gaps = parts.gaps ?? []
  const pendingTypeKeys = parts.pendingTypeKeys ?? []
  const blockedBy = uniqueBlockers(listed)
  const pending = pendingTypeKeys.length > 0 || (parts.pendingExclusionIds?.length ?? 0) > 0
  const blocked = blockedBy !== undefined || gaps.some((g) => g.severity === 'blocks-claim')
  const state = blocked ? 'blocked' : pending ? 'provisional' : 'ok'
  return { ...parts, ...(blockedBy ? { blockedBy } : {}), code, guide: GUIDE[code], state, gaps, pendingTypeKeys }
}
