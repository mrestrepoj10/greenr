import { proposeExclusions } from '@/lib/edge/exclusions'
import { computeRun } from '@/lib/edge/run'
import { readSnapshot, type ReadSnapshotOptions } from './snapshot'

export type GreenrDevHook = {
  readSnapshot: (opts?: ReadSnapshotOptions) => ReturnType<typeof readSnapshot>
  computeRun: typeof computeRun
  proposeExclusions: typeof proposeExclusions
}

declare global {
  interface Window {
    __greenr?: GreenrDevHook
  }
}

export function installDevHook(viewer: Autodesk.Viewing.Viewer3D): GreenrDevHook {
  const hook: GreenrDevHook = {
    readSnapshot: (opts) => readSnapshot(viewer, opts),
    computeRun,
    proposeExclusions,
  }
  window.__greenr = hook
  return hook
}
