const FT = 0.3048

/** The envelope probe's tuning, in metres. Defaults are the spike's values on 210 King, which were tuned in feet. */
export type Thresholds = {
  /** How far past each wall face to look for a room. Clears finishes and skirting, stays inside a narrow corridor. */
  probeOffsetM: number
  /** Floor on wall thickness when placing probes, so zero-thickness walls still probe both sides. */
  minProbeThicknessM: number
  samplesAlong: number
  maxSamplesUp: number
  /** Samples stay this far from the wall's bottom and top, away from slab edges. */
  sampleMarginM: number
  sampleSpacingM: number
  /** EDGE Part 3 EEM01: courts whose height is 3 or more times their width may be ignored. */
  courtAspect: number
  /** The outward march looks at least this far for a facing room. */
  minCourtLimitM: number
  courtStartM: number
  courtStepM: number
  /** One-sided samples must be at least this share of the non-parapet samples. The weakest real façade on 210 King scored 0.38, a massing wall 0.24. */
  minEvidence: number
  /** A neighbour wall this close to a façade face, and parallel to it, is a party wall. */
  partyContactM: number
  parallelCos: number
  /** Windows on a wall this covered by a neighbour cannot see outside, so they drop with the party wall. */
  partyGlazingCut: number
  hostBboxSlackM: number
  hostAlongSlackM: number
  hostDepthM: number
  hostMinThicknessM: number
  /** The 3 x 2 probe at an opening spans this share of its width and height. */
  openingProbeWidthShare: number
  openingProbeHeightShare: number
  defaultOpeningWidthM: number
  defaultOpeningHeightM: number
  /** A wall thinner than this, on the face of a thicker wall, is a finish layer: TORRE A models its 2 to 20 mm render and paint skins as walls. */
  minWallThicknessM: number
  /** How far a finish layer may stand off the face of the wall behind it. */
  finishLayerGapM: number
  /** Two parallel walls this close and mostly overlapping are layers of one façade, counted once. */
  layerGapM: number
  layerOverlap: number
  /** Room names that are outside the conditioned envelope: 210 King's Patio and Roof Decks, and the Spanish balconies, terraces, roofs and gardens. */
  outdoorRoomName: RegExp
  storeyGridM: number
  /** Room bases closer than this are one storey. */
  storeyBaseRoundM: number
  /** A slab counts as the floor above a room only when its top is this far above the room's base, which skips the room's own slab. */
  slabClearanceM: number
  fallbackFloorToFloorM: number
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  probeOffsetM: 1.5 * FT,
  minProbeThicknessM: 0.3 * FT,
  samplesAlong: 5,
  maxSamplesUp: 12,
  sampleMarginM: 2 * FT,
  sampleSpacingM: 6 * FT,
  courtAspect: 3,
  minCourtLimitM: 10 * FT,
  courtStartM: 2 * FT,
  courtStepM: 1 * FT,
  minEvidence: 0.3,
  partyContactM: 1 * FT,
  parallelCos: 0.995,
  partyGlazingCut: 0.99,
  hostBboxSlackM: 1 * FT,
  hostAlongSlackM: 0.5 * FT,
  hostDepthM: 1.5 * FT,
  hostMinThicknessM: 0.5 * FT,
  openingProbeWidthShare: 0.3,
  openingProbeHeightShare: 0.25,
  defaultOpeningWidthM: 3 * FT,
  defaultOpeningHeightM: 4 * FT,
  minWallThicknessM: 0.05,
  finishLayerGapM: 0.03,
  layerGapM: 0.5 * FT,
  layerOverlap: 0.5,
  outdoorRoomName: /deck|patio|terrace|balc[oó]n|porch|courtyard|exterior|terraza|cubierta|azotea|jard[ií]n/i,
  storeyGridM: 4 * FT,
  storeyBaseRoundM: 0.5 * FT,
  slabClearanceM: 4 * FT,
  fallbackFloorToFloorM: 12 * FT,
}
