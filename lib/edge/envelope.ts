import { azimuthOf } from './orientation'
import { roomAt, roomIndexOf, type RoomIndex } from './rooms'
import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds'
import type {
  AzimuthSource,
  Bbox,
  Element,
  FacadeGeometry,
  OpeningAreaSource,
  OpeningKind,
  ProbeTally,
  Snapshot,
  WallClass,
} from './types'

export type Side = -1 | 0 | 1

export type WallProbe = {
  element: Element
  geom: FacadeGeometry
  tally: ProbeTally
  wallClass: WallClass
  /** +1 when +n faces outside, -1 when -n does, 0 when the evidence is split or absent. */
  sign: Side
  fPlus: number
  exposedFrac: number
  aboveGradeFrac: number
  belowRoomTopFrac: number
  courtLimitM: number
  partyFrac: number
  partyWith: number[]
}

export type OpeningProbe = {
  element: Element
  kind: OpeningKind
  hostDbId: number | null
  azimuthDeg: number | null
  azimuthSource: AzimuthSource
  areaM2: number
  areaSource: OpeningAreaSource
}

export type EnvelopeAnalysis = {
  rooms: RoomIndex
  /** Every wall and curtain wall except finish layers. */
  walls: Map<number, WallProbe>
  /** Finish layers, out of the gross façade: each thin wall to the wall it covers. */
  finishLayers: Map<number, number>
  openings: Map<number, OpeningProbe>
  panelsOf: Map<number, number[]>
}

const cache = new WeakMap<Snapshot, EnvelopeAnalysis>()

export function analyzeEnvelope(snapshot: Snapshot, t: Thresholds = DEFAULT_THRESHOLDS): EnvelopeAnalysis {
  if (t === DEFAULT_THRESHOLDS) {
    const hit = cache.get(snapshot)
    if (hit) return hit
  }
  const rooms = roomIndexOf(snapshot, t)
  const finish = finishLayers(snapshot.elements, t)
  const walls = new Map<number, WallProbe>()
  for (const element of snapshot.elements) {
    const kind = element.facade?.kind
    if ((kind === 'wall' || kind === 'curtain-wall') && !finish.has(element.dbId)) walls.set(element.dbId, probeWall(element, rooms, t))
  }
  addPartyFractions([...walls.values()], t)

  // A skin can carry the opening cut where the wall behind it stops, as on TORRE A's light façade.
  const hosts: HostCandidate[] = [
    ...[...walls.values()].filter((w) => w.geom.kind === 'wall'),
    ...snapshot.elements.filter((e) => finish.has(e.dbId)).map((element) => ({ element, geom: element.facade! })),
  ]
  const openings = new Map<number, OpeningProbe>()
  const panelsOf = new Map<number, number[]>()
  for (const element of snapshot.elements) {
    const kind = openingKind(element)
    if (!kind) continue
    if (kind === 'panel') {
      openings.set(element.dbId, probePanel(element, walls))
      if (element.hostDbId !== undefined) {
        const list = panelsOf.get(element.hostDbId) ?? []
        list.push(element.dbId)
        panelsOf.set(element.hostDbId, list)
      }
    } else {
      openings.set(element.dbId, probeOpening(element, kind, hosts, walls, finish, rooms, t))
    }
  }
  const analysis = { rooms, walls, finishLayers: finish, openings, panelsOf }
  if (t === DEFAULT_THRESHOLDS) cache.set(snapshot, analysis)
  return analysis
}

function openingKind(element: Element): OpeningKind | null {
  const kind = element.facade?.kind
  if (kind === 'window' || kind === 'door' || kind === 'panel') return kind
  if (/Windows/.test(element.category)) return 'window'
  if (/Doors/.test(element.category)) return 'door'
  if (/Curtain Panels/.test(element.category)) return 'panel'
  return null
}

export function outwardAzimuth(g: FacadeGeometry, sign: Side): number | null {
  return sign === 0 ? null : azimuthOf([sign * g.n[0], sign * g.n[1]])
}

type Outside = 1 | -1 | 'both-sides-indoor' | 'no-room'

/** Which face of the wall looks outside at one sample: the face opposite the only room found next to it. */
function outsideAt(g: FacadeGeometry, rooms: RoomIndex, u: number, z: number, t: Thresholds): Outside {
  const off = Math.max(g.thickness, t.minProbeThicknessM) / 2 + t.probeOffsetM
  const bx = g.n[0] * g.sMid + g.u[0] * u
  const by = g.n[1] * g.sMid + g.u[1] * u
  const plus = roomAt(rooms, bx + g.n[0] * off, by + g.n[1] * off, z) !== null
  const minus = roomAt(rooms, bx - g.n[0] * off, by - g.n[1] * off, z) !== null
  if (plus && minus) return 'both-sides-indoor'
  if (plus) return -1
  if (minus) return 1
  return 'no-room'
}

function roomOutside(g: FacadeGeometry, rooms: RoomIndex, u: number, z: number, sign: 1 | -1, limit: number, t: Thresholds): boolean {
  const off = Math.max(g.thickness, t.minProbeThicknessM) / 2
  const bx = g.n[0] * g.sMid + g.u[0] * u
  const by = g.n[1] * g.sMid + g.u[1] * u
  for (let k = 0; ; k++) {
    const d = t.courtStartM + k * t.courtStepM
    if (d >= limit - 1e-9) return false
    if (roomAt(rooms, bx + sign * g.n[0] * (off + d), by + sign * g.n[1] * (off + d), z) !== null) return true
  }
}

type TallyResult = Pick<
  WallProbe,
  'tally' | 'wallClass' | 'sign' | 'fPlus' | 'exposedFrac' | 'aboveGradeFrac' | 'belowRoomTopFrac' | 'courtLimitM'
>

function tally(g: FacadeGeometry, rooms: RoomIndex, us: number[], zs: number[], t: Thresholds): TallyResult {
  const z0 = rooms.gradeZ
  const courtLimitM = Math.max(t.minCourtLimitM, (g.zmax - z0) / t.courtAspect)
  let outPlus = 0, outMinus = 0, enclosed = 0, both = 0, none = 0, aboveGrade = 0, total = 0
  let roomTop = -Infinity
  const noneZ: number[] = []
  for (const u of us) {
    for (const z of zs) {
      total++
      if (z > z0) aboveGrade++
      const outside = outsideAt(g, rooms, u, z, t)
      if (outside === 'no-room') {
        none++
        noneZ.push(z)
        continue
      }
      roomTop = Math.max(roomTop, z)
      if (outside === 'both-sides-indoor') both++
      else if (roomOutside(g, rooms, u, z, outside, courtLimitM, t)) enclosed++
      else if (outside === 1) outPlus++
      else outMinus++
    }
  }
  const parapet = noneZ.filter((z) => z > roomTop).length
  const one = outPlus + outMinus
  const eligible = Math.max(1, total - parapet)
  const wallClass: WallClass =
    one === 0
      ? enclosed > 0
        ? 'enclosed'
        : both > 0
          ? 'interior'
          : 'no-room'
      : both + enclosed > one
        ? 'mostly-interior'
        : one < t.minEvidence * eligible
          ? 'weak-evidence'
          : 'envelope'
  return {
    tally: { outPlus, outMinus, enclosed, both, none, parapet, aboveGrade, total },
    wallClass,
    sign: outPlus > outMinus ? 1 : outMinus > outPlus ? -1 : 0,
    fPlus: one ? outPlus / one : 0,
    exposedFrac: one ? one / (one + enclosed + both) : 0,
    aboveGradeFrac: total ? aboveGrade / total : 1,
    belowRoomTopFrac: total ? 1 - parapet / total : 1,
    courtLimitM,
  }
}

function sampleGrid(g: FacadeGeometry, t: Thresholds): { us: number[]; zs: number[] } {
  const us = Array.from({ length: t.samplesAlong }, (_, i) => g.umin + ((g.umax - g.umin) * (i + 0.5)) / t.samplesAlong)
  const h0 = g.zmin + t.sampleMarginM
  const h1 = g.zmax - t.sampleMarginM
  if (h1 <= h0) return { us, zs: [(g.zmin + g.zmax) / 2] }
  const k = Math.min(t.maxSamplesUp, Math.max(2, Math.round((h1 - h0) / t.sampleSpacingM) + 1))
  return { us, zs: Array.from({ length: k }, (_, i) => h0 + ((h1 - h0) * i) / (k - 1)) }
}

function probeWall(element: Element, rooms: RoomIndex, t: Thresholds): WallProbe {
  const geom = element.facade!
  const { us, zs } = sampleGrid(geom, t)
  return { element, geom, ...tally(geom, rooms, us, zs, t), partyFrac: 0, partyWith: [] }
}

function parallel(a: FacadeGeometry, b: FacadeGeometry, t: Thresholds): boolean {
  return Math.abs(Math.cos(((a.axisDeg - b.axisDeg) * Math.PI) / 180)) >= t.parallelCos
}

export function midplaneGap(a: FacadeGeometry, b: FacadeGeometry): number {
  const cx = b.n[0] * b.sMid + b.u[0] * b.uc
  const cy = b.n[1] * b.sMid + b.u[1] * b.uc
  return Math.abs(cx * a.n[0] + cy * a.n[1] - a.sMid)
}

export function overlap(a: FacadeGeometry, b: FacadeGeometry): { along: number; up: number } {
  const k = b.u[0] * a.u[0] + b.u[1] * a.u[1]
  const b0 = b.umin * k
  const b1 = b.umax * k
  return {
    along: Math.min(a.umax, Math.max(b0, b1)) - Math.max(a.umin, Math.min(b0, b1)),
    up: Math.min(a.zmax, b.zmax) - Math.max(a.zmin, b.zmin),
  }
}

/** Neighbouring structures show up as walls with no room evidence (often "Generic - Massing"). A façade face they touch is a party wall. */
function addPartyFractions(walls: WallProbe[], t: Thresholds): void {
  const context = walls.filter((w) => w.wallClass === 'no-room' || w.wallClass === 'weak-evidence')
  for (const a of walls) {
    if (a.wallClass !== 'envelope') continue
    const ga = a.geom
    const face = (ga.umax - ga.umin) * (ga.zmax - ga.zmin)
    let covered = 0
    for (const b of context) {
      const gb = b.geom
      if (!parallel(ga, gb, t)) continue
      if (midplaneGap(ga, gb) > (ga.thickness + gb.thickness) / 2 + t.partyContactM) continue
      const { along, up } = overlap(ga, gb)
      if (along > 0 && up > 0) {
        covered += (along * up) / face
        a.partyWith.push(b.element.dbId)
      }
    }
    a.partyFrac = Math.min(1, covered)
  }
}

const GRID_M = 2

/** Elements bucketed by the `GRID_M` cells their bbox, padded by `pad`, touches. A hash collision only adds candidates. */
function spatialGrid(elements: Element[], pad: number) {
  const cells = new Map<number, number[]>()
  const span = (b: Bbox, visit: (key: number) => void) => {
    const [i0, j0, k0] = [b[0], b[1], b[2]].map((x) => Math.floor((x - pad) / GRID_M))
    const [i1, j1, k1] = [b[3], b[4], b[5]].map((x) => Math.floor((x + pad) / GRID_M))
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) visit((i * 73856093) ^ (j * 19349663) ^ (k * 83492791))
  }
  elements.forEach((e, index) => span(e.bbox!, (key) => (cells.get(key) ?? cells.set(key, []).get(key)!).push(index)))
  const seen = new Int32Array(elements.length).fill(-1)
  let query = 0
  return (b: Bbox): Element[] => {
    const near: Element[] = []
    const stamp = query++
    span(b, (key) => {
      for (const index of cells.get(key) ?? []) {
        if (seen[index] === stamp) continue
        seen[index] = stamp
        near.push(elements[index])
      }
    })
    return near
  }
}

/**
 * Render, paint, tile and board skins modelled as walls: a basic wall thinner than `minWallThicknessM` whose face
 * lies within `finishLayerGapM` of thicker parallel walls over at least `layerOverlap` of its face. Each maps to the
 * innermost wall of its stack: paint on render on masonry maps to the masonry. Where TORRE A's light façade has no
 * stud core modelled, the 8 mm boards either side of the cavity stay walls and the graniplast on them is the skin.
 */
export function finishLayers(elements: Element[], t: Thresholds = DEFAULT_THRESHOLDS): Map<number, number> {
  const basic = elements.filter((e) => e.facade?.kind === 'wall' && e.bbox)
  const near = spatialGrid(basic, t.finishLayerGapM + t.minWallThicknessM)
  const under = new Map<number, number>()
  for (const skin of basic) {
    if (skin.facade!.thickness >= t.minWallThicknessM) continue
    const thicker = near(skin.bbox!).filter((w) => w.facade!.thickness > skin.facade!.thickness)
    const wall = coveredBy(skin, thicker, t)
    if (wall !== null) under.set(skin.dbId, wall)
  }
  const layers = new Map<number, number>()
  for (const [skin, wall] of under) {
    let root = wall
    while (under.has(root)) root = under.get(root)!
    layers.set(skin, root)
  }
  return layers
}

/** The wall a skin covers most, when parallel walls within the gap cover enough of its face together. */
function coveredBy(skin: Element, candidates: Element[], t: Thresholds): number | null {
  const gs = skin.facade!
  const face = (gs.umax - gs.umin) * (gs.zmax - gs.zmin)
  if (face <= 0) return null
  let covered = 0
  let best: { dbId: number; share: number } | null = null
  for (const wall of candidates) {
    const gw = wall.facade!
    if (!parallel(gs, gw, t)) continue
    if (midplaneGap(gw, gs) > (gw.thickness + gs.thickness) / 2 + t.finishLayerGapM) continue
    const { along, up } = overlap(gs, gw)
    if (along <= 0 || up <= 0) continue
    const share = (along * up) / face
    covered += share
    if (!best || share > best.share) best = { dbId: wall.dbId, share }
  }
  return best && covered >= t.layerOverlap ? best.dbId : null
}

function bboxCentre(element: Element): [number, number, number] | null {
  const b = element.bbox
  return b ? [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2] : null
}

type HostCandidate = Pick<WallProbe, 'element' | 'geom'>

/** Openings carry no Host property in the viewer, so the host is the nearest wall whose midplane and extent contain the opening centre. */
export function findHost(
  centre: [number, number, number],
  hosts: HostCandidate[],
  t: Thresholds,
): { wall: HostCandidate; along: number } | null {
  const [cx, cy, cz] = centre
  let best: { wall: HostCandidate; along: number; d: number } | null = null
  for (const wall of hosts) {
    const b = wall.element.bbox
    const s = t.hostBboxSlackM
    if (!b || cx < b[0] - s || cx > b[3] + s || cy < b[1] - s || cy > b[4] + s || cz < b[2] - s || cz > b[5] + s) continue
    const h = wall.geom
    const along = cx * h.u[0] + cy * h.u[1]
    if (along < h.umin - t.hostAlongSlackM || along > h.umax + t.hostAlongSlackM) continue
    const d = Math.abs(cx * h.n[0] + cy * h.n[1] - h.sMid)
    if (d > Math.max(h.thickness, t.hostMinThicknessM) / 2 + t.hostDepthM) continue
    if (!best || d < best.d) best = { wall, along, d }
  }
  return best && { wall: best.wall, along: best.along }
}

function openingArea(element: Element): { areaM2: number; areaSource: OpeningAreaSource } {
  const rw = element.params['Rough Width']
  const rh = element.params['Rough Height']
  if (typeof rw === 'number' && typeof rh === 'number' && rw > 0 && rh > 0) return { areaM2: rw * rh, areaSource: 'rough-opening' }
  if (element.width && element.height) return { areaM2: element.width * element.height, areaSource: 'width-height' }
  return geometryArea(element)
}

function geometryArea(element: Element): { areaM2: number; areaSource: OpeningAreaSource } {
  const g = element.facade
  return g ? { areaM2: (g.umax - g.umin) * (g.zmax - g.zmin), areaSource: 'geometry' } : { areaM2: 0, areaSource: 'none' }
}

function probeOpening(
  element: Element,
  kind: OpeningKind,
  hosts: HostCandidate[],
  walls: Map<number, WallProbe>,
  finish: Map<number, number>,
  rooms: RoomIndex,
  t: Thresholds,
): OpeningProbe {
  const area = openingArea(element)
  const centre = bboxCentre(element)
  const own = element.facade
  const declared = element.hostDbId === undefined ? undefined : walls.get(element.hostDbId)
  const host =
    declared && centre
      ? { wall: declared, along: centre[0] * declared.geom.u[0] + centre[1] * declared.geom.u[1] }
      : own && centre
        ? findHost(centre, hosts, t)
        : null
  if (host && centre) {
    const hg = host.wall.geom
    const hw = (element.width || t.defaultOpeningWidthM) * t.openingProbeWidthShare
    const hh = (element.height || t.defaultOpeningHeightM) * t.openingProbeHeightShare
    const local = tally(hg, rooms, [host.along - hw, host.along, host.along + hw], [centre[2] - hh, centre[2] + hh], t)
    const hostDbId = finish.get(host.wall.element.dbId) ?? host.wall.element.dbId
    if (local.sign) return { element, kind, hostDbId, azimuthDeg: outwardAzimuth(hg, local.sign), azimuthSource: 'probe-at-opening', ...area }
    const majority = walls.get(hostDbId)!.sign
    if (majority) return { element, kind, hostDbId, azimuthDeg: outwardAzimuth(hg, majority), azimuthSource: 'host-majority', ...area }
    return { element, kind, hostDbId, azimuthDeg: null, azimuthSource: 'none', ...area }
  }
  if (own) {
    const { us, zs } = sampleGrid(own, t)
    const self = tally(own, rooms, us, zs, t)
    if (self.sign) return { element, kind, hostDbId: null, azimuthDeg: outwardAzimuth(own, self.sign), azimuthSource: 'own-probe', ...area }
  }
  return { element, kind, hostDbId: null, azimuthDeg: null, azimuthSource: 'none', ...area }
}

function probePanel(element: Element, walls: Map<number, WallProbe>): OpeningProbe {
  const area =
    element.area && element.area > 0 ? { areaM2: element.area, areaSource: 'area-parameter' as const } : geometryArea(element)
  const parent = element.hostDbId === undefined ? undefined : walls.get(element.hostDbId)
  const azimuthDeg = parent ? outwardAzimuth(parent.geom, parent.sign) : null
  return {
    element,
    kind: 'panel',
    hostDbId: element.hostDbId ?? null,
    azimuthDeg,
    azimuthSource: azimuthDeg === null ? 'none' : 'parent-wall',
    ...area,
  }
}
