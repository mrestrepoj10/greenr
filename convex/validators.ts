import { v, type Infer, type VLiteral, type VUnion } from 'convex/values'

type Literals<T extends readonly string[]> = VUnion<T[number], VLiteral<T[number]>[]>

function literals<const T extends readonly string[]>(values: T): Literals<T> {
  const members = values.map((s) => v.literal(s)) as [VLiteral<T[number]>, VLiteral<T[number]>, ...VLiteral<T[number]>[]]
  return v.union(...members)
}

export const orientation = literals(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const)

export const elementRole = literals([
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
] as const)

export const classificationSource = literals(['rule', 'model', 'user'] as const)

export const exclusionReason = literals([
  'below-grade',
  'massing',
  'unconditioned',
  'party-wall',
  'parapet',
  'shaft',
  'user',
] as const)

export const exclusionSource = literals(['rule', 'agent', 'user'] as const)

export const exclusionStatus = literals(['proposed', 'accepted', 'rejected'] as const)

export const northSource = literals(['project', 'true-north-param', 'user'] as const)

export const units = literals(['ft', 'm'] as const)

export const runState = literals([
  'idle',
  'loading',
  'snapshot',
  'classifying',
  'measuring',
  'provisional',
  'confirmed',
  'exported',
] as const)

export const scheme = literals(['EDGE', 'CASA'] as const)

export const measureCode = literals([
  'D-GIA',
  'D-FLOORS',
  'D-F2F',
  'D-ROOF',
  'EEM01',
  'EEM02',
  'EEM09',
  'AU-SKYLIGHT',
  'C-ENV',
  'C-FLOOD',
  'C-VENT',
  'C-WATER',
  'C-FLEX',
  'C-SRI',
  'C-GLAZE',
] as const)

export const guideRef = v.object({
  doc: v.string(),
  version: v.string(),
  page: v.string(),
  title: v.string(),
  url: v.string(),
})

export const projectInputs = v.object({
  typology: v.optional(literals(['no-vis', 'vis', 'vip'] as const)),
  housingForm: v.optional(literals(['unifamiliar', 'multifamiliar'] as const)),
  municipality: v.optional(v.string()),
  municipalityCategory: v.optional(literals(['E', '1', '2', '3', '4', '5', '6'] as const)),
  climateZone: v.optional(literals(['frio', 'templado', 'calido-seco', 'calido-humedo'] as const)),
  roadGradeM: v.optional(v.number()),
  floodElevationM: v.optional(v.number()),
  floodReturnYears: v.optional(v.union(v.literal(50), v.literal(100))),
  inFloodplain: v.optional(v.boolean()),
  datumOffsetM: v.optional(v.number()),
  projectAreaM2: v.optional(v.number()),
})

export const projectInputKey = literals([
  'typology',
  'housingForm',
  'municipality',
  'municipalityCategory',
  'climateZone',
  'roadGradeM',
  'floodElevationM',
  'floodReturnYears',
  'inFloodplain',
  'datumOffsetM',
  'projectAreaM2',
] as const)

export const measureBlocker = v.union(
  v.object({ kind: v.literal('missing-input'), input: projectInputKey }),
  v.object({ kind: v.literal('not-implemented') }),
)

export const inputValue = v.object({
  label: v.string(),
  value: v.union(v.number(), v.string(), v.null()),
  unit: v.string(),
  source: literals(['parameter', 'geometry', 'levels', 'rooms', 'mixed'] as const),
  dbIds: v.optional(v.array(v.number())),
})

/** A gap without its dbIds. They live in runElements under `gap:<id>`. */
export const storedGap = v.object({
  id: v.string(),
  measure: measureCode,
  typeKey: v.string(),
  missing: v.string(),
  severity: literals(['blocks-claim', 'needs-data-sheet', 'info'] as const),
  message: v.string(),
})

/** An orientation row without its dbIds. They live in runElements under `<code>:orientation:<o>:wall|glazing`. */
export const storedOrientationRow = v.object({
  orientation,
  wallAreaM2: v.number(),
  glazingAreaM2: v.number(),
  wwr: v.union(v.number(), v.null()),
})

export const storedMeasure = v.object({
  code: measureCode,
  guide: guideRef,
  state: literals(['ok', 'provisional', 'blocked'] as const),
  inputs: v.array(inputValue),
  blockedBy: v.optional(v.array(measureBlocker)),
  orientations: v.optional(v.array(storedOrientationRow)),
  gaps: v.array(storedGap),
  pendingTypeKeys: v.array(v.string()),
})

export const runSnapshot = v.object({
  modelUrn: v.string(),
  viewableGuid: v.string(),
  viewableName: v.string(),
  units,
  north: v.object({ source: northSource, angleDeg: v.number() }),
  takenAt: v.string(),
})

export const runFields = {
  runId: v.string(),
  state: runState,
  schemes: v.array(scheme),
  guides: v.object({ EDGE: v.string(), CASA: v.string() }),
  inputs: projectInputs,
  snapshot: runSnapshot,
  measures: v.array(storedMeasure),
  computedAt: v.string(),
  elementCount: v.number(),
}

export const runElementFields = {
  key: v.string(),
  chunk: v.number(),
  dbIds: v.array(v.number()),
}

export const classificationFields = {
  typeKey: v.string(),
  role: elementRole,
  source: classificationSource,
  confidence: v.number(),
  reason: v.string(),
}

export const exclusionFields = {
  id: v.string(),
  dbIds: v.array(v.number()),
  reason: exclusionReason,
  source: exclusionSource,
  status: exclusionStatus,
  note: v.optional(v.string()),
}

export const projectFields = {
  slug: v.string(),
  modelUrn: v.string(),
  modelName: v.string(),
  viewableName: v.string(),
  viewableGuid: v.string(),
  northAngleDeg: v.number(),
  northSource,
}

export const projectScopeFields = {
  schemes: v.array(scheme),
  inputs: projectInputs,
}

export const runDoc = v.object({
  _id: v.id('runs'),
  _creationTime: v.number(),
  projectId: v.id('projects'),
  ...runFields,
})

export const runElementDoc = v.object({
  _id: v.id('runElements'),
  _creationTime: v.number(),
  runId: v.id('runs'),
  ...runElementFields,
})

export const classificationDoc = v.object({
  _id: v.id('classifications'),
  _creationTime: v.number(),
  projectId: v.id('projects'),
  updatedAt: v.number(),
  ...classificationFields,
})

export const exclusionDoc = v.object({
  _id: v.id('exclusions'),
  _creationTime: v.number(),
  projectId: v.id('projects'),
  updatedAt: v.number(),
  ...exclusionFields,
})

export const projectDoc = v.object({
  _id: v.id('projects'),
  _creationTime: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  ...projectFields,
  ...projectScopeFields,
})

export const packDoc = v.object({
  _id: v.id('packs'),
  _creationTime: v.number(),
  runId: v.id('runs'),
  projectId: v.id('projects'),
  url: v.string(),
  size: v.number(),
  manifest: v.any(),
  createdAt: v.number(),
})

export type StoredMeasure = Infer<typeof storedMeasure>
export type StoredRunFields = Infer<typeof runDoc>
export type StoredRunElement = Infer<typeof runElementDoc>
export type StoredClassification = Infer<typeof classificationDoc>
export type StoredExclusion = Infer<typeof exclusionDoc>
export type StoredProject = Infer<typeof projectDoc>
export type StoredPack = Infer<typeof packDoc>
