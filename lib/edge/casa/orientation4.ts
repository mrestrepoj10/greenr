import { mod360 } from '../orientation'
import type { Element, OpeningEvidence, OrientationRow, Snapshot, WallEvidence } from '../types'

export const CARDINALS = ['N', 'E', 'S', 'W'] as const
export type Cardinal = (typeof CARDINALS)[number]

/**
 * CASA GGc5, SBp3 and the MS&C form ask for 4 façades, not EDGE's 8: 90 degree sectors centred on the cardinals.
 * A façade exactly on a sector edge goes to the clockwise sector, as in `binAzimuth`, so N covers [315, 45).
 */
export function binCardinal(azimuthDeg: number, northAngleDeg = 0): Cardinal {
  return CARDINALS[Math.round(mod360(azimuthDeg - northAngleDeg) / 90) % 4]
}

type Bucket = {
  opaque: number
  curtain: number
  windows: number
  doors: number
  curtainGlazing: number
  wallDbIds: Set<number>
  glazingDbIds: Set<number>
}

/** Mirrors `openingKind` in the envelope probe: a curtain panel is anything the probe treats as one. */
function isPanel(e: Element): boolean {
  const kind = e.facade?.kind
  if (kind === 'panel') return true
  if (kind === 'window' || kind === 'door' || /Windows|Doors/.test(e.category)) return false
  return /Curtain Panels/.test(e.category)
}

/**
 * The EEM01 façade re-binned into 4 cardinal rows from each wall's and opening's own azimuth. Summing EDGE's 8 bins
 * would be wrong: a NE wall belongs wholly to N or E by its azimuth, not half to each. The evidence already carries
 * confirmed exclusions (`countedAreaM2`, `counted`), so the parts and their sum are EEM01's, only the sectors differ.
 */
export function cardinalRows(snapshot: Snapshot, walls: readonly WallEvidence[], openings: readonly OpeningEvidence[]): OrientationRow[] {
  const byId = new Map(snapshot.elements.map((e) => [e.dbId, e]))
  const north = snapshot.north.angleDeg
  const panelHosts = new Set(snapshot.elements.filter(isPanel).map((e) => e.hostDbId))
  const buckets = Object.fromEntries(
    CARDINALS.map((c) => [c, { opaque: 0, curtain: 0, windows: 0, doors: 0, curtainGlazing: 0, wallDbIds: new Set(), glazingDbIds: new Set() }]),
  ) as Record<Cardinal, Bucket>

  for (const wall of walls) {
    if (!wall.counted) continue
    const curtain = byId.get(wall.dbId)?.facade?.kind === 'curtain-wall'
    const glazedHost = wall.role === 'curtain-glazed' && !panelHosts.has(wall.dbId)
    for (const [az, share] of [
      [wall.azimuthPlusDeg, wall.fPlus],
      [wall.azimuthPlusDeg + 180, 1 - wall.fPlus],
    ] as const) {
      const part = wall.countedAreaM2 * share
      if (part <= 0) continue
      const b = buckets[binCardinal(az, north)]
      if (curtain) b.curtain += part
      else b.opaque += part
      b.wallDbIds.add(wall.dbId)
      if (glazedHost) {
        b.curtainGlazing += part
        b.glazingDbIds.add(wall.dbId)
      }
    }
  }

  for (const op of openings) {
    if (!op.counted || op.azimuthDeg === null) continue
    const b = buckets[binCardinal(op.azimuthDeg, north)]
    const inCurtain = op.hostDbId !== null && byId.get(op.hostDbId)?.facade?.kind === 'curtain-wall'
    if (op.role === 'door') {
      if (!inCurtain) b.doors += op.areaM2
      b.wallDbIds.add(op.dbId)
    } else {
      if (op.role === 'window' && !inCurtain) b.windows += op.areaM2
      else b.curtainGlazing += op.areaM2
      b.glazingDbIds.add(op.dbId)
    }
  }

  return CARDINALS.map((orientation): OrientationRow => {
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
}
