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

export type Exclusion = {
  id: string
  dbIds: number[]
  reason: ExclusionReason
  /** Who proposed it. The agent proposes, the person confirms. */
  source: 'rule' | 'agent' | 'user'
  confirmed: boolean
  note?: string
}

export type Vec3 = [number, number, number]
/** minX, minY, minZ, maxX, maxY, maxZ in model units. */
export type Bbox = [number, number, number, number, number, number]

export type Level = {
  name: string
  /** Elevation in model units. */
  elevation: number
  dbId?: number
}

/** One element as read from the viewer property database and fragment geometry. */
export type Element = {
  dbId: number
  typeKey: string
  category: string
  family?: string
  typeName?: string
  level?: string
  /** Revit area parameter in model units squared, when the element has one. */
  area?: number
  width?: number
  height?: number
  length?: number
  /** Outward normal in model coordinates, for walls and panels. */
  normal?: Vec3
  bbox?: Bbox
  /** Host wall dbId for windows and doors, when it could be resolved. */
  hostDbId?: number
  params: Record<string, number | string | null>
}

export type Units = 'ft' | 'm'

export type NorthSource = 'project' | 'true-north-param' | 'user'

export type Snapshot = {
  modelUrn: string
  viewableGuid: string
  viewableName: string
  units: Units
  levels: Level[]
  elements: Element[]
  /** Degrees clockwise from +Y to north. 0 means project north is +Y. */
  north: { source: NorthSource; angleDeg: number }
  takenAt: string
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

export const MEASURE_CODES = [
  'D-GIA',
  'D-FLOORS',
  'D-F2F',
  'D-ROOF',
  'EEM01',
  'EEM02',
  'EEM09',
  'AU-SKYLIGHT',
] as const
export type MeasureCode = (typeof MEASURE_CODES)[number]

export type GuideRef = {
  /** EDGE V3.1 user guide part number. */
  part: 1 | 2 | 3 | 4 | 5 | 8
  page: string
  title: string
  url: string
}

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
  orientations?: OrientationRow[]
  gaps: Gap[]
  /** Element type keys whose classification is below the confidence threshold. */
  pendingTypeKeys: string[]
}

export type RunResult = {
  runId: string
  state: RunState
  guideVersion: 'V3.1'
  snapshot: Pick<Snapshot, 'modelUrn' | 'viewableGuid' | 'viewableName' | 'units' | 'north' | 'takenAt'>
  classifications: Classification[]
  exclusions: Exclusion[]
  measures: MeasureResult[]
  computedAt: string
}

export type Measure = {
  code: MeasureCode
  guide: GuideRef
  compute: (snapshot: Snapshot, classifications: Classification[], exclusions: Exclusion[]) => MeasureResult
}
