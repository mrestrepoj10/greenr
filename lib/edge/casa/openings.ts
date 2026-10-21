import { param, positive } from '../params'
import { roomAt, type RoomIndex } from '../rooms'
import type { Element } from '../types'

/** Rough opening, then nominal width by height, then the opening's own face: the order EEM01 measures openings in. */
export function openingAreaM2(e: Element): number {
  const rw = positive(e.params, 'Rough Width')
  const rh = positive(e.params, 'Rough Height')
  if (rw && rh) return rw * rh
  const w = e.width || positive(e.params, 'Width')
  const h = e.height || positive(e.params, 'Height')
  if (w && h) return w * h
  const g = e.facade
  return g ? (g.umax - g.umin) * (g.zmax - g.zmin) : 0
}

/** Balcony and patio doors are most of a dwelling's glazing (TORRE A: 150 of them, 137 typed Interior), so a door counts as glazing by its name. */
export const GLAZED_DOOR = /corrediz|sliding|vidri|glass|glaz|acristal|ventana|french|balc[oó]n/i

export type OpeningFactor = { name: RegExp; share: number; label: string }

/**
 * The share of W x H that opens, by how the family name says the window opens. These are greenr's assumptions, not
 * CASA values: SBp1 counts only the useful opening, so one sash of a two-sash slider is half the window.
 */
export const OPENING_FACTORS: readonly OpeningFactor[] = [
  { name: /fij[ao]|fixed|picture/i, share: 0, label: 'fixed' },
  { name: /corrediz|sliding|desliz/i, share: 0.5, label: 'sliding, one of two sashes' },
  { name: /guillotina|hung/i, share: 0.5, label: 'hung, one of two sashes' },
  { name: /awning|proyectante|basculante|batiente|casement|abatible/i, share: 1, label: 'projecting or casement' },
]

export type OperableShare = { share: number; source: 'parameter' | 'family-name' }

const YES = /^(yes|s[ií]|true)$/i
const NO = /^(no|false)$/i

/** `Operable` as a share from 0 to 1, or Yes/No. A Yes takes the family's share, or the whole opening when the name says nothing. */
export function operableShare(e: Element): OperableShare | null {
  const fromName = OPENING_FACTORS.find((f) => f.name.test(e.typeKey))?.share
  const raw = param(e.params, 'Operable')
  const value = typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw
  if (typeof value === 'number' && value >= 0 && value <= 1) return { share: value, source: 'parameter' }
  if (typeof value === 'string' && NO.test(value.trim())) return { share: 0, source: 'parameter' }
  if (typeof value === 'string' && YES.test(value.trim())) return { share: fromName ?? 1, source: 'parameter' }
  return fromName === undefined ? null : { share: fromName, source: 'family-name' }
}

const PROBE_STEPS_M = [0.3, 0.6, 1]

function probe(e: Element, rooms: RoomIndex, dx: number, dy: number): number | null {
  const b = e.bbox
  if (!b) return null
  const [cx, cy, cz] = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]
  const half = (e.facade?.thickness ?? 0) / 2
  for (const d of PROBE_STEPS_M) {
    const id = roomAt(rooms, cx + dx * (half + d), cy + dy * (half + d), cz)
    if (id !== null) return id
  }
  return null
}

/** The room an exterior opening serves: the first room met walking inward from it, against its outward azimuth. */
export function roomBehind(e: Element, outwardAzimuthDeg: number, rooms: RoomIndex): number | null {
  const rad = (outwardAzimuthDeg * Math.PI) / 180
  return probe(e, rooms, -Math.sin(rad), -Math.cos(rad))
}

/** Rooms on either face of a window or door, for openings whose outside is not known. */
export function roomsEitherSide(e: Element, rooms: RoomIndex): number[] {
  const n = e.facade?.n
  if (!n) return []
  return [probe(e, rooms, n[0], n[1]), probe(e, rooms, -n[0], -n[1])].filter((id): id is number => id !== null)
}
