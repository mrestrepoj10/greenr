import { analyzeEnvelope, midplaneGap, overlap, type OpeningProbe, type WallProbe } from '../envelope'
import { applyExclusions, keptShare, touching } from '../exclusions'
import { azimuthOf, binAzimuth } from '../orientation'
import { FACADE_WALL_ROLES, pendingOf, roleIndex } from '../roles'
import { DEFAULT_THRESHOLDS } from '../thresholds'
import {
  ORIENTATIONS,
  type Classification,
  type Exclusion,
  type Measure,
  type OpeningEvidence,
  type Orientation,
  type OrientationRow,
  type Snapshot,
  type WallEvidence,
} from '../types'
import { GUIDE } from '../guide'
import { measureResult } from './result'

type Bucket = {
  opaque: number
  curtain: number
  windows: number
  doors: number
  curtainGlazing: number
  wallDbIds: Set<number>
  glazingDbIds: Set<number>
}

export type CountedGlazing = { dbId: number; typeKey: string; areaM2: number; orientation: Orientation }

export type FacadeTally = {
  rows: OrientationRow[]
  walls: WallEvidence[]
  openings: OpeningEvidence[]
  glazing: CountedGlazing[]
  pendingTypeKeys: string[]
  pendingExclusionIds: string[]
}

const t = DEFAULT_THRESHOLDS

function layerDuplicates(walls: WallProbe[]): Map<number, number> {
  const sorted = [...walls].sort((a, b) => (b.element.area ?? 0) - (a.element.area ?? 0))
  const duplicateOf = new Map<number, number>()
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]
    if (duplicateOf.has(a.element.dbId)) continue
    const azA = azimuthOf([a.sign * a.geom.n[0], a.sign * a.geom.n[1]])
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]
      if (duplicateOf.has(b.element.dbId)) continue
      const ga = a.geom
      const gb = b.geom
      if (Math.abs(Math.cos(((ga.axisDeg - gb.axisDeg) * Math.PI) / 180)) < t.parallelCos) continue
      const azB = azimuthOf([b.sign * gb.n[0], b.sign * gb.n[1]])
      if (Math.abs(((azA - azB + 540) % 360) - 180) > 30) continue
      if (midplaneGap(ga, gb) > (ga.thickness + gb.thickness) / 2 + t.layerGapM) continue
      const { along, up } = overlap(ga, gb)
      if (along > t.layerOverlap * (gb.umax - gb.umin) && up > t.layerOverlap * (gb.zmax - gb.zmin)) {
        duplicateOf.set(b.element.dbId, a.element.dbId)
      }
    }
  }
  return duplicateOf
}

export function tallyFacade(snapshot: Snapshot, classifications: Classification[], exclusions: Exclusion[]): FacadeTally {
  const env = analyzeEnvelope(snapshot)
  const roles = roleIndex(classifications)
  const applied = applyExclusions(exclusions)
  const north = snapshot.north.angleDeg
  const buckets = Object.fromEntries(
    ORIENTATIONS.map((o) => [
      o,
      { opaque: 0, curtain: 0, windows: 0, doors: 0, curtainGlazing: 0, wallDbIds: new Set(), glazingDbIds: new Set() },
    ]),
  ) as Record<Orientation, Bucket>

  const involved: string[] = []
  const candidates: WallProbe[] = []
  const wallReason = new Map<number, string>()
  for (const wall of env.walls.values()) {
    const role = roles.roleOf(wall.element)
    if (wall.wallClass === 'envelope') involved.push(wall.element.typeKey)
    if (wall.wallClass !== 'envelope') wallReason.set(wall.element.dbId, `room probe: ${wall.wallClass}`)
    else if (role === null) wallReason.set(wall.element.dbId, 'type not classified yet')
    else if (!FACADE_WALL_ROLES.has(role)) wallReason.set(wall.element.dbId, `classified ${role}`)
    else if (applied.removed.has(wall.element.dbId)) wallReason.set(wall.element.dbId, 'excluded')
    else candidates.push(wall)
  }
  const duplicateOf = layerDuplicates(candidates)
  for (const [dup, of] of duplicateOf) wallReason.set(dup, `second layer of wall ${of}, counted once`)

  const counted = new Set<number>()
  const walls: WallEvidence[] = []
  for (const wall of env.walls.values()) {
    const role = roles.roleOf(wall.element)
    if (!(role !== null && FACADE_WALL_ROLES.has(role)) && wall.wallClass !== 'envelope') continue
    const area = wall.element.area ?? 0
    const isCounted = !wallReason.has(wall.element.dbId)
    const factor = isCounted ? keptShare(wall, applied) : 0
    const azPlus = azimuthOf(wall.geom.n)
    const byOrientation: Partial<Record<Orientation, number>> = {}
    if (isCounted) {
      counted.add(wall.element.dbId)
      const glazedHost = role === 'curtain-glazed' && !env.panelsOf.has(wall.element.dbId)
      for (const [az, share] of [
        [azPlus, wall.fPlus],
        [azPlus + 180, 1 - wall.fPlus],
      ] as const) {
        const part = area * factor * share
        if (part <= 0) continue
        const o = binAzimuth(az, north)
        const bucket = buckets[o]
        if (wall.geom.kind === 'curtain-wall') bucket.curtain += part
        else bucket.opaque += part
        bucket.wallDbIds.add(wall.element.dbId)
        if (glazedHost) {
          bucket.curtainGlazing += part
          bucket.glazingDbIds.add(wall.element.dbId)
        }
        byOrientation[o] = (byOrientation[o] ?? 0) + part
      }
    }
    walls.push({
      dbId: wall.element.dbId,
      typeKey: wall.element.typeKey,
      role,
      wallClass: wall.wallClass,
      azimuthPlusDeg: azPlus,
      probe: wall.tally,
      fPlus: wall.fPlus,
      aboveGradeFrac: wall.aboveGradeFrac,
      exposedFrac: wall.exposedFrac,
      belowRoomTopFrac: wall.belowRoomTopFrac,
      partyFrac: wall.partyFrac,
      partyWith: wall.partyWith,
      courtLimitM: wall.courtLimitM,
      revitAreaM2: area,
      appliedFactor: factor,
      countedAreaM2: area * factor,
      areaByOrientation: byOrientation,
      counted: isCounted,
      reason: wallReason.get(wall.element.dbId) ?? describeFactors(wall, applied.portions.get(wall.element.dbId)),
    })
  }

  const openings: OpeningEvidence[] = []
  const glazing: CountedGlazing[] = []
  const countedOpenings = new Set<number>()
  for (const op of env.openings.values()) {
    const role = roles.roleOf(op.element)
    const hostWall = op.hostDbId === null ? undefined : env.walls.get(op.hostDbId)
    if (hostWall?.wallClass === 'envelope') involved.push(op.element.typeKey)
    const hostCounted = op.hostDbId !== null && (counted.has(op.hostDbId) || counted.has(duplicateOf.get(op.hostDbId) ?? -1))
    const reason = openingReason(op, role, hostCounted, hostWall, applied)
    const orientation = op.azimuthDeg === null ? null : binAzimuth(op.azimuthDeg, north)
    const isCounted = reason === null && orientation !== null
    if (isCounted) {
      countedOpenings.add(op.element.dbId)
      const bucket = buckets[orientation]
      // A curtain wall's Area already covers everything set in it, so its openings add glazing but no gross area.
      const inCurtain = hostWall?.geom.kind === 'curtain-wall'
      if (role === 'door') {
        if (!inCurtain) bucket.doors += op.areaM2
        bucket.wallDbIds.add(op.element.dbId)
      } else {
        if (role === 'window' && !inCurtain) bucket.windows += op.areaM2
        else bucket.curtainGlazing += op.areaM2
        bucket.glazingDbIds.add(op.element.dbId)
        glazing.push({ dbId: op.element.dbId, typeKey: op.element.typeKey, areaM2: op.areaM2, orientation })
      }
    }
    if (isCounted || role === null || role === 'window' || role === 'curtain-glazed' || role === 'skylight') {
      openings.push({
        dbId: op.element.dbId,
        typeKey: op.element.typeKey,
        kind: op.kind,
        role,
        hostDbId: op.hostDbId,
        azimuthDeg: op.azimuthDeg,
        azimuthSource: op.azimuthSource,
        orientation,
        areaM2: op.areaM2,
        areaSource: op.areaSource,
        counted: isCounted,
        reason: reason ?? (orientation === null ? 'no outward side found' : 'counted'),
      })
    }
  }

  const rows = ORIENTATIONS.map((orientation): OrientationRow => {
    const b = buckets[orientation]
    const gross = b.opaque + b.curtain + b.windows + b.doors
    const glazed = b.windows + b.curtainGlazing
    return {
      orientation,
      wallDbIds: [...b.wallDbIds],
      glazingDbIds: [...b.glazingDbIds],
      wallAreaM2: gross,
      glazingAreaM2: glazed,
      wwr: gross > 0 ? glazed / gross : null,
      opaqueWallAreaM2: b.opaque,
      curtainWallAreaM2: b.curtain,
      windowAreaM2: b.windows,
      doorAreaM2: b.doors,
      curtainGlazingAreaM2: b.curtainGlazing,
    }
  })
  const touched = new Set([...candidates.map((w) => w.element.dbId), ...countedOpenings])
  return {
    rows,
    walls,
    openings,
    glazing,
    pendingTypeKeys: pendingOf(involved, roles),
    pendingExclusionIds: touching(applied.unconfirmed, touched),
  }
}

function openingReason(
  op: OpeningProbe,
  role: string | null,
  hostCounted: boolean,
  hostWall: WallProbe | undefined,
  applied: ReturnType<typeof applyExclusions>,
): string | null {
  if (role === null) return 'type not classified yet'
  if (role === 'skylight') return 'skylight: counted in EEM25, not in façade glazing'
  const expected = op.kind === 'panel' ? ['curtain-glazed'] : ['window', 'door', 'curtain-glazed']
  if (!expected.includes(role)) return op.kind === 'panel' && role === 'curtain-solid' ? 'opaque panel, inside its curtain wall area' : `classified ${role}`
  if (applied.removed.has(op.element.dbId)) return 'excluded'
  if (op.hostDbId === null) return 'no host wall found'
  if (!hostCounted) return `host wall ${op.hostDbId} is not on the counted façade`
  if (
    op.kind === 'window' &&
    hostWall &&
    applied.portions.get(hostWall.element.dbId)?.has('party-wall') &&
    hostWall.partyFrac >= t.partyGlazingCut
  ) {
    return `host wall ${hostWall.element.dbId} is a party wall`
  }
  return null
}

function describeFactors(wall: WallProbe, portions: ReadonlySet<string> | undefined): string {
  const parts = [`room probe: envelope, ${Math.round(wall.fPlus * 100)}% of one-sided samples face +n`]
  if (portions?.size) parts.push(`confirmed exclusions applied: ${[...portions].sort().join(', ')}`)
  return parts.join('; ')
}

export const EEM01: Measure = {
  code: 'EEM01',
  guide: GUIDE.EEM01,
  compute(snapshot, classifications, exclusions) {
    const tally = tallyFacade(snapshot, classifications, exclusions)
    const gross = tally.rows.reduce((s, r) => s + r.wallAreaM2, 0)
    const glazed = tally.rows.reduce((s, r) => s + r.glazingAreaM2, 0)
    const north = snapshot.north
    return measureResult('EEM01', {
      inputs: [
        { label: 'Overall window-to-wall ratio', value: gross > 0 ? glazed / gross : null, unit: 'ratio', source: 'mixed' },
        { label: 'Gross exposed façade area', value: gross, unit: 'm²', source: 'mixed', dbIds: tally.rows.flatMap((r) => r.wallDbIds) },
        { label: 'External glazing area, frames included', value: glazed, unit: 'm²', source: 'parameter', dbIds: tally.rows.flatMap((r) => r.glazingDbIds) },
        {
          label: `North reference (${north.source}), degrees clockwise from project north`,
          value: north.angleDeg,
          unit: '°',
          source: 'parameter',
        },
      ],
      orientations: tally.rows,
      pendingTypeKeys: tally.pendingTypeKeys,
      pendingExclusionIds: tally.pendingExclusionIds,
      envelope: { walls: tally.walls, openings: tally.openings },
    })
  },
}
