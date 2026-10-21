export const ORIENTATIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type Orientation = (typeof ORIENTATIONS)[number]

export const ELEMENT_ROLES = [
  'exterior-wall',
  'interior-wall',
  'massing',
  'parapet',
  'window',
  'curtain-glazed',
  'curtain-solid',
  'door',
  'skylight',
  'roof',
  'floor',
  'room',
  'shading',
  'plumbing-fixture',
  'lighting-fixture',
  'equipment',
  'parking',
  'planting',
  'area',
  'pipe',
  'other',
] as const
export type ElementRole = (typeof ELEMENT_ROLES)[number]

export type ClassificationSource = 'rule' | 'model' | 'user'

/** One row per unique type in the model. The type, not the element, is what a person confirms. */
export type Classification = {
  typeKey: string
  role: ElementRole
  source: ClassificationSource
  /** 1 for rule and user. A model answer carries the decision model's probability. */
  confidence: number
  /** Plain words for the review table, for example "Function = Exterior". */
  reason: string
}

export const EXCLUSION_REASONS = [
  'below-grade',
  'massing',
  'unconditioned',
  'party-wall',
  'parapet',
  'shaft',
  'user',
] as const
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number]

/** Only an accepted exclusion changes a measure. A proposed one keeps the run provisional; a rejected one is kept so it is not proposed again. */
export const EXCLUSION_STATUSES = ['proposed', 'accepted', 'rejected'] as const
export type ExclusionStatus = (typeof EXCLUSION_STATUSES)[number]

export type Exclusion = {
  id: string
  dbIds: number[]
  reason: ExclusionReason
  /** Who proposed it. The agent proposes, the person decides. */
  source: 'rule' | 'agent' | 'user'
  status: ExclusionStatus
  note?: string
}

export type Vec3 = [number, number, number]
/** minX, minY, minZ, maxX, maxY, maxZ in metres, world coordinates. */
export type Bbox = [number, number, number, number, number, number]

export type Level = {
  name: string
  /** Elevation in metres. */
  elevation: number
  dbId?: number
}

export const FACADE_KINDS = ['wall', 'curtain-wall', 'panel', 'window', 'door'] as const
export type FacadeKind = (typeof FACADE_KINDS)[number]

/** Plan geometry of one wall, curtain wall, curtain panel, window or door, read from its triangles. Metres. */
export type FacadeGeometry = {
  kind: FacadeKind
  /** Plan angle of `n`, degrees counter-clockwise from +X, 0 to 180. */
  axisDeg: number
  /** Unit plan normal of the main faces. Either face: the envelope probe decides which side is outside. */
  n: [number, number]
  /** Unit plan direction along the element, `n` turned 90 degrees counter-clockwise. */
  u: [number, number]
  /** Midplane offset along `n`: a plan point p lies on the midplane when p·n = sMid. */
  sMid: number
  thickness: number
  umin: number
  umax: number
  zmin: number
  zmax: number
  /** Area-weighted centre of the main faces along `u`. */
  uc: number
  /** Area of the near-vertical faces, both sides, in m². */
  verticalArea: number
}

/** The floor of one room in plan, from its bottom faces. Metres. */
export type Footprint = {
  /** Plan triangles, six numbers each: x0 y0 x1 y1 x2 y2. */
  triangles: number[]
  zmin: number
  zmax: number
  /** Revit "Base Offset" of the room above its level. */
  baseOffset: number
}

/** One element as read from the viewer property database and fragment geometry. */
export type Element = {
  dbId: number
  typeKey: string
  category: string
  family?: string
  typeName?: string
  level?: string
  /** Revit area parameter in m², when the element has one. */
  area?: number
  /** Metres, like every length in a snapshot. */
  width?: number
  height?: number
  length?: number
  /** Outward normal in model coordinates, for walls and panels. */
  normal?: Vec3
  bbox?: Bbox
  /** The curtain wall that owns a panel, window or door, from the instance tree. Windows in basic walls have none; the engine finds their host from geometry. */
  hostDbId?: number
  params: Record<string, number | string | null>
  /** Present on walls, curtain panels, windows and doors that have near-vertical faces. */
  facade?: FacadeGeometry
  /** Present on rooms. */
  footprint?: Footprint
}

export type Units = 'ft' | 'm'

export type NorthSource = 'project' | 'true-north-param' | 'user'

export type SnapshotStats = {
  elements: number
  triangles: number
  /** Fragments whose geometry was not resident. Non-zero means some elements were measured without their faces. */
  missingGeometry: number
  propertyScanMs: number
  geometryMs: number
  totalMs: number
}

export type Snapshot = {
  modelUrn: string
  viewableGuid: string
  viewableName: string
  /** The model's own length unit. Every number in a snapshot is already in metres and m². */
  units: Units
  levels: Level[]
  elements: Element[]
  /** Degrees clockwise from +Y to north. 0 means project north is +Y. */
  north: { source: NorthSource; angleDeg: number }
  takenAt: string
  stats?: SnapshotStats
}

export const RUN_STATES = [
  'idle',
  'loading',
  'snapshot',
  'classifying',
  'measuring',
  'provisional',
  'confirmed',
  'exported',
] as const
export type RunState = (typeof RUN_STATES)[number]

export const SCHEMES = ['EDGE', 'CASA'] as const
export type Scheme = (typeof SCHEMES)[number]

export const MEASURE_CODES = {
  EDGE: ['D-GIA', 'D-FLOORS', 'D-F2F', 'D-ROOF', 'EEM01', 'EEM02', 'EEM09', 'AU-SKYLIGHT'],
  CASA: ['C-ENV', 'C-FLOOD', 'C-VENT', 'C-WATER', 'C-FLEX', 'C-SRI', 'C-GLAZE'],
} as const satisfies Record<Scheme, readonly string[]>
export type MeasureCodeOf<S extends Scheme> = (typeof MEASURE_CODES)[S][number]
export type MeasureCode = MeasureCodeOf<Scheme>
export const ALL_MEASURE_CODES = [...MEASURE_CODES.EDGE, ...MEASURE_CODES.CASA] as const

const SCHEME_OF = Object.fromEntries(SCHEMES.flatMap((s) => MEASURE_CODES[s].map((code) => [code, s]))) as Record<MeasureCode, Scheme>
export const schemeOf = (code: MeasureCode): Scheme => SCHEME_OF[code]
export const isCodeOf = <S extends Scheme>(scheme: S, code: MeasureCode): code is MeasureCodeOf<S> => SCHEME_OF[code] === scheme

/** `page` is the printed page; `url` opens the PDF at it, past any cover. */
export type GuideRef = {
  doc: string
  version: string
  page: string
  title: string
  url: string
}

export const TYPOLOGIES = ['no-vis', 'vis', 'vip'] as const
export const HOUSING_FORMS = ['unifamiliar', 'multifamiliar'] as const
export const MUNICIPALITY_CATEGORIES = ['E', '1', '2', '3', '4', '5', '6'] as const
export const CLIMATE_ZONES = ['frio', 'templado', 'calido-seco', 'calido-humedo'] as const
export const FLOOD_RETURN_YEARS = [50, 100] as const

/** What the person types for CASA and Res. 0194. Every field is optional: a CASA measure that needs a missing one is blocked and names it. */
export type ProjectInputs = {
  typology?: (typeof TYPOLOGIES)[number]
  housingForm?: (typeof HOUSING_FORMS)[number]
  /** DIVIPOLA code. */
  municipality?: string
  municipalityCategory?: (typeof MUNICIPALITY_CATEGORIES)[number]
  /** Picked by the person from Anexo 2 or the Minvivienda geovisor, never derived from the municipality. */
  climateZone?: (typeof CLIMATE_ZONES)[number]
  /** Elevations in metres, in the survey datum. */
  roadGradeM?: number
  floodElevationM?: number
  floodReturnYears?: (typeof FLOOD_RETURN_YEARS)[number]
  inFloodplain?: boolean
  /** Survey datum minus the project base point elevation, metres. */
  datumOffsetM?: number
  projectAreaM2?: number
}
export type ProjectInputKey = keyof ProjectInputs

/** Why a measure cannot report yet. A blocked measure names what it waits for instead of guessing. */
export type MeasureBlocker = { kind: 'missing-input'; input: ProjectInputKey } | { kind: 'not-implemented' }

export type Gap = {
  id: string
  measure: MeasureCode
  typeKey: string
  dbIds: number[]
  /** The parameter that is missing or zero, for example "Solar Heat Gain Coefficient". */
  missing: string
  severity: 'blocks-claim' | 'needs-data-sheet' | 'info'
  message: string
}

export type OrientationRow = {
  orientation: Orientation
  wallDbIds: number[]
  glazingDbIds: number[]
  /** Gross façade area: walls plus windows plus doors, in m². */
  wallAreaM2: number
  /** Glazing area including frames, in m². */
  glazingAreaM2: number
  /** 0 to 1. Null when the orientation has no façade. */
  wwr: number | null
  /** The parts of the gross façade, in m²: opaque basic walls, curtain walls, windows and doors. */
  opaqueWallAreaM2?: number
  curtainWallAreaM2?: number
  windowAreaM2?: number
  doorAreaM2?: number
  /** Glazing inside curtain walls: glazed panels and windows set in them. Part of the curtain wall area, so not added to gross. */
  curtainGlazingAreaM2?: number
}

export const WALL_CLASSES = ['envelope', 'interior', 'mostly-interior', 'enclosed', 'weak-evidence', 'no-room'] as const
/** What the room probe concluded about a wall. Only "envelope" walls can count toward the façade. */
export type WallClass = (typeof WALL_CLASSES)[number]

/** Room probe samples on one wall: a grid along its length and height, a room looked for on each side. */
export type ProbeTally = {
  /** Room on the -n side only and open air beyond +n, so +n faces outside. */
  outPlus: number
  outMinus: number
  /** One-sided, but another room within the court limit outside: a shaft, a chase or a court with aspect ratio of 3 or more. */
  enclosed: number
  both: number
  none: number
  /** No-room samples above the highest sample that touched a room. */
  parapet: number
  aboveGrade: number
  total: number
}

/** Why a wall counts toward EEM01, or why not, and how much of it. */
export type WallEvidence = {
  dbId: number
  typeKey: string
  role: ElementRole | null
  wallClass: WallClass
  /** Azimuth of +n, degrees clockwise from project north. */
  azimuthPlusDeg: number
  probe: ProbeTally
  /** Share of the one-sided samples whose outside is +n. The area splits between the two faces by it. */
  fPlus: number
  aboveGradeFrac: number
  /** One-sided samples over all samples that met a room. */
  exposedFrac: number
  belowRoomTopFrac: number
  /** Share of the wall face in contact with a neighbouring structure. */
  partyFrac: number
  partyWith: number[]
  /** How far outside the probe looked for another room, metres. */
  courtLimitM: number
  revitAreaM2: number
  /** The product of the fractions that confirmed exclusions applied. */
  appliedFactor: number
  /** Area added to the gross façade, m². 0 when the wall does not count. */
  countedAreaM2: number
  areaByOrientation: Partial<Record<Orientation, number>>
  counted: boolean
  reason: string
}

export type OpeningKind = 'window' | 'door' | 'panel'
export type AzimuthSource = 'probe-at-opening' | 'host-majority' | 'own-probe' | 'parent-wall' | 'none'
export type OpeningAreaSource = 'rough-opening' | 'width-height' | 'area-parameter' | 'geometry' | 'none'

/** Why a window, door or curtain panel counts toward EEM01, or why not. */
export type OpeningEvidence = {
  dbId: number
  typeKey: string
  kind: OpeningKind
  role: ElementRole | null
  hostDbId: number | null
  azimuthDeg: number | null
  azimuthSource: AzimuthSource
  orientation: Orientation | null
  areaM2: number
  areaSource: OpeningAreaSource
  counted: boolean
  reason: string
}

/** A threshold the measured value crossed, with the rule that sets it. */
export type MeasureFlag = {
  id: string
  /** "flag" asks for attention; "mandatory" means a measure becomes required. */
  level: 'flag' | 'mandatory'
  threshold: number
  message: string
  guide: GuideRef
}

export type ValueSource = 'parameter' | 'geometry' | 'levels' | 'rooms' | 'mixed'

export type InputValue = {
  label: string
  value: number | string | null
  unit: string
  source: ValueSource
  dbIds?: number[]
}

export type MeasureResult = {
  code: MeasureCode
  guide: GuideRef
  state: 'ok' | 'provisional' | 'blocked'
  inputs: InputValue[]
  blockedBy?: MeasureBlocker[]
  orientations?: OrientationRow[]
  gaps: Gap[]
  /** Element type keys whose classification is below the confidence threshold. */
  pendingTypeKeys: string[]
  /** Unconfirmed exclusions that would change this measure once confirmed. */
  pendingExclusionIds?: string[]
  flags?: MeasureFlag[]
  /** EEM01 only: per-element evidence for the walls and openings the measure considered. */
  envelope?: { walls: WallEvidence[]; openings: OpeningEvidence[] }
}

export type RunScope = {
  schemes: Scheme[]
  inputs: ProjectInputs
}

export type RunResult = RunScope & {
  runId: string
  state: RunState
  /** The guide version each scheme cites, as of the run. */
  guides: Record<Scheme, string>
  snapshot: Pick<Snapshot, 'modelUrn' | 'viewableGuid' | 'viewableName' | 'units' | 'north' | 'takenAt'>
  classifications: Classification[]
  exclusions: Exclusion[]
  measures: MeasureResult[]
  computedAt: string
}

type MeasureOf<S extends Scheme> = {
  scheme: S
  code: MeasureCodeOf<S>
  guide: GuideRef
  /** What the measure feeds: EDGE EEM codes, CASA credit and prerequisite codes, MS&C form sections. */
  credits: string[]
  compute: (snapshot: Snapshot, classifications: Classification[], exclusions: Exclusion[], inputs: ProjectInputs) => MeasureResult
}

export type Measure = { [S in Scheme]: MeasureOf<S> }[Scheme]
