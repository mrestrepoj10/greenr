import { GUIDE_VERSIONS } from './guide'
import { runMeasures } from './measures'
import { SCHEMES, type Classification, type Exclusion, type RunResult, type RunScope, type Snapshot } from './types'

function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const snapshotKey = (s: Pick<Snapshot, 'modelUrn' | 'viewableGuid' | 'takenAt'>) => `${s.modelUrn}|${s.viewableGuid}|${s.takenAt}`

export const DEFAULT_SCOPE: RunScope = { schemes: ['EDGE'], inputs: {} }

/**
 * One pass of the selected schemes' measures over a snapshot. Provisional while any measure waits on a classification
 * or an exclusion. The run id is derived from the snapshot, so recomputing after a confirmation or a scheme change keeps
 * it. `now` is the only clock read.
 */
export function computeRun(
  snapshot: Snapshot,
  classifications: Classification[],
  exclusions: Exclusion[],
  { schemes, inputs }: RunScope,
  prev?: RunResult,
  now: string = new Date().toISOString(),
): RunResult {
  const measures = runMeasures(snapshot, classifications, exclusions, inputs, schemes)
  const waiting = measures.some(
    (m) => m.state === 'provisional' || m.pendingTypeKeys.length > 0 || (m.pendingExclusionIds?.length ?? 0) > 0,
  )
  const key = snapshotKey(snapshot)
  return {
    runId: prev && snapshotKey(prev.snapshot) === key ? prev.runId : `run-${fnv1a(key)}`,
    state: waiting ? 'provisional' : 'confirmed',
    schemes: SCHEMES.filter((s) => schemes.includes(s)),
    guides: GUIDE_VERSIONS,
    inputs,
    snapshot: {
      modelUrn: snapshot.modelUrn,
      viewableGuid: snapshot.viewableGuid,
      viewableName: snapshot.viewableName,
      units: snapshot.units,
      north: snapshot.north,
      takenAt: snapshot.takenAt,
    },
    classifications,
    exclusions,
    measures,
    computedAt: now,
  }
}
