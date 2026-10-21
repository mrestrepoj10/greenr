import { classifySnapshot } from '@/lib/classify'
import type { Element, Snapshot } from '@/lib/edge/types'
import { installDevHook } from '@/lib/viewer/dev-hook'

const FIXTURE_CATEGORIES = /Walls|Curtain Panels|Windows|Doors|Roofs|Floors|Rooms/

/** Rounds to 0.1 mm and drops what the engine never reads, so the 210 King snapshot fits in a small fixture. */
function fixtureOf(snapshot: Snapshot): Snapshot {
  const round = (x: number) => Math.round(x * 1e4) / 1e4
  const deep = <T>(v: T): T =>
    (typeof v === 'number' ? round(v) : Array.isArray(v) ? v.map(deep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v) as T
  const elements = snapshot.elements
    .filter((e) => FIXTURE_CATEGORIES.test(e.category))
    .map((e): Element => deep({ ...e, params: Object.fromEntries(Object.entries(e.params).filter(([, v]) => v !== null && v !== '')) }))
  return { ...snapshot, elements, levels: deep(snapshot.levels), stats: undefined }
}

const viewer = (window as unknown as { NOP_VIEWER: Autodesk.Viewing.Viewer3D }).NOP_VIEWER
installDevHook(viewer)
;(window as unknown as Record<string, unknown>).__greenrVerify = { classifySnapshot, fixtureOf }
