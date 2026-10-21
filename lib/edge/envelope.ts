import { azimuthOf } from './orientation'
import { roomAt, roomIndexOf, type RoomIndex } from './rooms'
import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds'
import type {
  AzimuthSource,
  Element,
  FacadeGeometry,
  OpeningAreaSource,
  OpeningKind,
  ProbeTally,
  Snapshot,
  WallClass,
} from './types'

export type Side = -1 | 0 | 1

/** What the room probe found on one wall. Geometry only: no classification goes in. */
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
  walls: Map<number, WallProbe>
  openings: Map<number, OpeningProbe>
  /** Curtain wall dbId to the dbIds of its panels. */
  panelsOf: Map<number, number[]>
}

const cache = new WeakMap<Snapshot, EnvelopeAnalysis>()

/** The room probe over every wall, opening and panel of a snapshot. Pure; memoised per snapshot for the default thresholds. */
export function analyzeEnvelope(snapshot: Snapshot, t: Thresholds = DEFAULT_THRESHOLDS): EnvelopeAnalysis {
  if (t === DEFAULT_THRESHOLDS) {
    const hit = cache.get(snapshot)
    if (hit) return hit
  }
  const rooms = roomIndexOf(snapshot, t)
  const walls = new Map<number, WallProbe>()
  for (const element of snapshot.elements) {
    const kind = element.facade?.kind
    if (kind === 'wall' || kind === 'curtain-wall') walls.set(element.dbId, probeWall(element, rooms, t))
  }
  addPartyFractions([...walls.values()], t)

  const hosts = [...walls.values()].filter((w) => w.geom.kind === 'wall')
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
      openings.set(element.dbId, probeOpening(element, kind, hosts, walls, rooms, t))
    }
  }
  const analysis = { rooms, walls, openings, panelsOf }
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

/** -1 when a room lies only on the +n side (so -n is outside), +1 for the reverse, 0 for rooms on both sides, null for none. */
function sideAt(g: FacadeGeometry, rooms: RoomIndex, u: number, z: number, t: Thresholds): Side | null {
  const off = Math.max(g.thickness, t.minProbeThicknessM) / 2 + t.probeOffsetM
  const bx = g.n[0] * g.sMid + g.u[0] * u
  const by = g.n[1] * g.sMid + g.u[1] * u
  const plus = roomAt(rooms, bx + g.n[0] * off, by + g.n[1] * off, z)
  const minus = roomAt(rooms, bx - g.n[0] * off, by - g.n[1] * off, z)
  if (plus && minus) return 0
  if (plus) return -1
  if (minus) return 1
  return null
}

/** True when another room sits outside within the court limit: a shaft, chase or court with aspect ratio of 3 or more. */
function roomOutside(g: FacadeGeometry, rooms: RoomIndex, u: number, z: number, sign: Side, limit: number, t: Thresholds): boolean {
  const off = Math.max(g.thickness, t.minProbeThicknessM) / 2
  const bx = g.n[0] * g.sMid + g.u[0] * u
  const by = g.n[1] * g.sMid + g.u[1] * u
  for (let k = 0; ; k++) {
    const d = t.courtStartM + k * t.courtStepM
    if (d >= limit - 1e-9) return false
    if (roomAt(rooms, bx + sign * g.n[0] * (off + d), by + sign * g.n[1] * (off + d), z)) return true
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
      const side = sideAt(g, rooms, u, z, t)
      if (side === null) {
        none++
        noneZ.push(z)
        continue
      }
      roomTop = Math.max(roomTop, z)
      if (side === 0) both++
      else if (roomOutside(g, rooms, u, z, side, courtLimitM, t)) enclosed++
      else if (side === 1) outPlus++
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

/** Plan distance from b's face centre to a's midplane. */
export function midplaneGap(a: FacadeGeometry, b: FacadeGeometry): number {
  const cx = b.n[0] * b.sMid + b.u[0] * b.uc
  const cy = b.n[1] * b.sMid + b.u[1] * b.uc
  return Math.abs(cx * a.n[0] + cy * a.n[1] - a.sMid)
}

/** Overlap of b with a along a's length and in height. */
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

function bboxCentre(element: Element): [number, number, number] | null {
  const b = element.bbox
  return b ? [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2] : null
}

/** Openings carry no Host property in the viewer, so the host is the nearest wall whose midplane and extent contain the opening centre. */
export function findHost(
  centre: [number, number, number],
  hosts: WallProbe[],
  t: Thresholds,
): { wall: WallProbe; along: number } | null {
  const [cx, cy, cz] = centre
  let best: { wall: WallProbe; along: number; d: number } | null = null
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
  hosts: WallProbe[],
  walls: Map<number, WallProbe>,
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
    const hostDbId = host.wall.element.dbId
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
