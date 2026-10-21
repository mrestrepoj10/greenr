import { classifySnapshot } from '@/lib/classify'
import { analyzeEnvelope } from '@/lib/edge/envelope'
import type { Element, Snapshot } from '@/lib/edge/types'
import { installDevHook } from '@/lib/viewer/dev-hook'

const round = (x: number) => Math.round(x * 1e4) / 1e4
const deep = <T>(v: T): T =>
  (typeof v === 'number'
    ? round(v)
    : Array.isArray(v)
      ? v.map(deep)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]))
        : v) as T

/** The 210 King fixture recipe: the named categories, numbers to 0.1 mm, empty params and stats dropped. */
function fixtureOf(snapshot: Snapshot, categories: RegExp): Snapshot {
  const elements = snapshot.elements
    .filter((e) => categories.test(e.category))
    .map((e): Element => deep({ ...e, params: Object.fromEntries(Object.entries(e.params).filter(([, v]) => v !== null && v !== '')) }))
  return { ...snapshot, elements, levels: deep(snapshot.levels), stats: undefined }
}

/** What the c2 check asserts, computed in the page so only the summary crosses to node. */
function summarize(snapshot: Snapshot) {
  const count = (es: Element[]) => es.reduce<Record<string, number>>((n, e) => ({ ...n, [e.category]: (n[e.category] ?? 0) + 1 }), {})
  const roles = new Map(classifySnapshot(snapshot).merged.map((c) => [c.typeKey, c.role]))
  const byRole = snapshot.elements.reduce<Record<string, number>>((n, e) => {
    const role = roles.get(e.typeKey) ?? 'leftover'
    return { ...n, [role]: (n[role] ?? 0) + 1 }
  }, {})
  const env = analyzeEnvelope(snapshot)
  const openings = [...env.openings.values()]
  const hosted = (category: string) => {
    const of = openings.filter((o) => o.element.category === category)
    return { hosted: of.filter((o) => o.hostDbId !== null).length, total: of.length }
  }
  const sliding = openings.filter((o) => o.element.category === 'Revit Doors' && /corrediza/i.test(o.element.typeKey))
  return {
    view: snapshot.viewableName,
    stats: snapshot.stats,
    levels: snapshot.levels.length,
    categories: count(snapshot.elements),
    roles: byRole,
    unplacedRooms: snapshot.elements.filter((e) => e.unplaced).length,
    finishLayers: env.finishLayers.size,
    windows: hosted('Revit Windows'),
    doors: hosted('Revit Doors'),
    slidingDoors: {
      hosted: sliding.filter((o) => o.hostDbId !== null).length,
      interior: sliding.filter((o) => o.element.params.Function === 'Interior').length,
      total: sliding.length,
    },
    plumbingFixtures: count(snapshot.elements.filter((e) => roles.get(e.typeKey) === 'plumbing-fixture')),
  }
}

/** Walls blue, finish layers grey, hosted openings green, unhosted red, everything else hidden. */
function colour(viewer: Autodesk.Viewing.Viewer3D, snapshot: Snapshot) {
  const env = analyzeEnvelope(snapshot)
  const THREE = (globalThis as unknown as { THREE: { Vector4: new (r: number, g: number, b: number, a: number) => unknown } }).THREE
  const paint = (ids: number[], rgb: [number, number, number]) =>
    ids.forEach((id) => viewer.setThemingColor(id, new THREE.Vector4(...rgb, 1) as THREE.Vector4, viewer.model, true))
  viewer.clearThemingColors(viewer.model)
  paint([...env.walls.keys()], [0.25, 0.45, 0.95])
  paint([...env.finishLayers.keys()], [0.82, 0.82, 0.82])
  const openings = [...env.openings.values()].filter((o) => o.kind !== 'panel')
  paint(openings.filter((o) => o.hostDbId !== null).map((o) => o.element.dbId), [0.15, 0.75, 0.3])
  paint(openings.filter((o) => o.hostDbId === null).map((o) => o.element.dbId), [0.95, 0.2, 0.2])
  viewer.setGhosting(false)
  viewer.isolate([...env.walls.keys(), ...env.finishLayers.keys(), ...openings.map((o) => o.element.dbId)])
}

const viewer = (window as unknown as { NOP_VIEWER: Autodesk.Viewing.Viewer3D }).NOP_VIEWER
installDevHook(viewer)
;(window as unknown as Record<string, unknown>).__c2 = { fixtureOf, summarize, colour: (s: Snapshot) => colour(viewer, s) }
