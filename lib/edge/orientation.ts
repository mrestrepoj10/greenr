import { ORIENTATIONS, type Orientation } from './types'

export function mod360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** Plan azimuth of a horizontal direction, degrees clockwise from project north (+Y), in [0, 360). */
export function azimuthOf(direction: readonly number[]): number {
  return mod360(90 - (Math.atan2(direction[1], direction[0]) * 180) / Math.PI)
}

/**
 * EDGE's "closest of the eight orientations": 45 degree sectors centred on N, NE, E and so on.
 * A façade exactly on a sector edge goes to the clockwise sector, so N covers [337.5, 22.5).
 * `northAngleDeg` is true north measured clockwise from project north.
 */
export function binAzimuth(azDeg: number, northAngleDeg = 0): Orientation {
  return ORIENTATIONS[Math.round(mod360(azDeg - northAngleDeg) / 45) % 8]
}
