import type {
  Classification,
  Exclusion,
  Gap,
  GuideRef,
  MeasureResult,
  OrientationRow,
  RunResult,
} from '@/lib/edge/types'

const GUIDE_BASE = 'https://edgebuildings.com/wp-content/uploads'
const PART_URL = {
  2: `${GUIDE_BASE}/2024/11/Part-2-User-Guide-Design-Tab-Rev-1.pdf`,
  3: `${GUIDE_BASE}/2024/11/Part-3-User-Guide-Energy-Measures-Rev-1.pdf`,
  8: `${GUIDE_BASE}/2025/07/Part-8-Auditor-Guidance-Rev-1.pdf`,
} as const

function guide(part: keyof typeof PART_URL, page: string, title: string): GuideRef {
  return { part, page, title, url: `${PART_URL[part]}#page=${page.split('-')[0]}` }
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

// dbIds come from the unit 0 spike on 210_King_Arch.rvt (New Construction view),
// so a row click lands on the real façade in the viewer.
const WALLS = {
  N: [293, 324, 325, 326],
  E: [308, 322, 323, 327],
  S: [299, 311, 312, 331, 445, 451, 452, 453, 454, 455, 1495, 2416, 5766],
  SW: [350, 512, 1497],
  W: [296, 473, 1496],
}
const GLAZING = {
  N: [450, 544, 545, 546, 740, ...range(831, 836), 1557, ...range(1595, 1600), 2415, ...range(2451, 2456), 3357, ...range(3405, 3410), 4654, ...range(4695, 4700), ...range(5739, 5742), ...range(5772, 5775), ...range(5854, 5857), ...range(5925, 5928)],
  E: [541, 829, 830, 1593, 1594, 2449, 2450, ...range(3397, 3403), 4656, ...range(4687, 4694)],
  S: [...range(314, 317), 328, 334, ...range(464, 472), ...range(733, 735), ...range(747, 766), 1498, 1499, ...range(1516, 1518), ...range(1535, 1551)],
  SW: [352, 811, 1561, 1562, 2417, 2418, 3363, 3364, 4655, 5801],
  W: [...range(336, 347), ...range(482, 511), ...range(773, 790)],
}
const MASSING_WALLS = range(6003, 6072)
const BELOW_GRADE = [...range(5591, 5598), ...range(5714, 5724), ...range(5726, 5728)]
const ROOFS = [1801, 1802, 1803, 1804, 2902]
const SKYLIGHTS = [2910, 2911, 2912]

const empty: OrientationRow = { orientation: 'NE', wallDbIds: [], glazingDbIds: [], wallAreaM2: 0, glazingAreaM2: 0, wwr: null }

function row(orientation: OrientationRow['orientation'], wallAreaM2: number, glazingAreaM2: number): OrientationRow {
  const walls = WALLS[orientation as keyof typeof WALLS] ?? []
  const glazing = GLAZING[orientation as keyof typeof GLAZING] ?? []
  if (wallAreaM2 === 0) return { ...empty, orientation }
  return {
    orientation,
    wallDbIds: walls,
    glazingDbIds: glazing,
    wallAreaM2,
    glazingAreaM2,
    wwr: Math.round((glazingAreaM2 / wallAreaM2) * 1000) / 1000,
  }
}

export const MOCK_ORIENTATIONS: OrientationRow[] = [
  row('N', 1155.6, 343.6),
  row('NE', 0, 0),
  row('E', 1554.4, 125.8),
  row('SE', 0, 0),
  row('S', 1406.1, 560.2),
  row('SW', 111.7, 27.3),
  row('W', 1072.9, 407),
  row('NW', 0, 0),
]

const GLAZING_TYPE = 'BLDG1 - Windows - Level 3 to 5 : 49.5" x 74"'
const KEYSTONE_TYPE = 'BLDG1 - WindowKeyStone - Level 3 to 5 : 49.5" x 74"'
const ROOF_TYPE = 'Basic Roof : BLDG1 - Membrane on Deck'

const gaps: Gap[] = [
  {
    id: 'gap-eem02-shgc',
    measure: 'EEM02',
    typeKey: GLAZING_TYPE,
    dbIds: range(747, 766),
    missing: 'Solar Heat Gain Coefficient',
    severity: 'blocks-claim',
    message: 'The glazing type has no SHGC, so EEM02 cannot be entered from the model.',
  },
  {
    id: 'gap-eem02-u',
    measure: 'EEM02',
    typeKey: KEYSTONE_TYPE,
    dbIds: range(1535, 1551),
    missing: 'Thermal Transmittance (U)',
    severity: 'needs-data-sheet',
    message: 'The glazing type has no U value. A manufacturer data sheet can supply it.',
  },
  {
    id: 'gap-eem09-sri',
    measure: 'EEM09',
    typeKey: ROOF_TYPE,
    dbIds: ROOFS,
    missing: 'Solar Reflectance Index',
    severity: 'info',
    message: 'The roof type has no SRI. EEM09 stays unclaimed until one is entered.',
  },
]

export const MOCK_PENDING: Classification[] = [
  {
    typeKey: 'Basic Wall : BLDG3 - Brick on CMU - Party',
    role: 'exterior-wall',
    source: 'model',
    confidence: 0.54,
    reason: 'Function = Exterior, but every face touches another building.',
  },
  {
    typeKey: 'Curtain Wall : BLDG4 - Storefront - Spandrel',
    role: 'curtain-solid',
    source: 'model',
    confidence: 0.41,
    reason: 'Panel material is opaque in name only; no glazing parameters.',
  },
  {
    typeKey: 'Generic Model : Roof Screen Louvre',
    role: 'shading',
    source: 'model',
    confidence: 0.33,
    reason: 'Sits on the roof with no host; could be roof or shading.',
  },
]

const PENDING_DBIDS: Record<string, number[]> = {
  [MOCK_PENDING[0].typeKey]: [5766, 2416, 1495],
  [MOCK_PENDING[1].typeKey]: range(4687, 4694),
  [MOCK_PENDING[2].typeKey]: [2920, 2921],
}

export function dbIdsForType(typeKey: string): number[] {
  return PENDING_DBIDS[typeKey] ?? []
}

export const MOCK_EXCLUSIONS: Exclusion[] = [
  {
    id: 'excl-massing',
    dbIds: MASSING_WALLS,
    reason: 'massing',
    source: 'agent',
    confirmed: false,
    note: 'Walls flagged "Massing" in Revit. They model the site context, not the building envelope.',
  },
  {
    id: 'excl-below-grade',
    dbIds: BELOW_GRADE,
    reason: 'below-grade',
    source: 'agent',
    confirmed: false,
    note: 'Walls on BLDG 1 BASEMENT FLR. FIN. sit entirely below ground level.',
  },
]

const confirmedRules: Classification[] = [
  { typeKey: 'Basic Wall : BLDG1 - North Wall - BaseStoneWall', role: 'exterior-wall', source: 'rule', confidence: 1, reason: 'Function = Exterior' },
  { typeKey: GLAZING_TYPE, role: 'window', source: 'rule', confidence: 1, reason: 'Category = Windows' },
  { typeKey: KEYSTONE_TYPE, role: 'window', source: 'rule', confidence: 1, reason: 'Category = Windows' },
  { typeKey: ROOF_TYPE, role: 'roof', source: 'rule', confidence: 1, reason: 'Category = Roofs' },
]

const measures: MeasureResult[] = [
  {
    code: 'D-GIA',
    guide: guide(2, '19', 'Gross internal floor area'),
    state: 'provisional',
    inputs: [{ label: 'Gross internal area proxy', value: 9874, unit: 'm²', source: 'rooms' }],
    gaps: [],
    pendingTypeKeys: [],
  },
  {
    code: 'D-FLOORS',
    guide: guide(2, '20', 'Number of floors'),
    state: 'provisional',
    inputs: [
      { label: 'Floors above grade', value: 6, unit: 'floors', source: 'levels' },
      { label: 'Floors below grade', value: 1, unit: 'floors', source: 'levels' },
    ],
    gaps: [],
    pendingTypeKeys: [],
  },
  {
    code: 'D-F2F',
    guide: guide(2, '21', 'Floor to floor height'),
    state: 'provisional',
    inputs: [{ label: 'Area-weighted floor to floor', value: 3.4, unit: 'm', source: 'levels' }],
    gaps: [],
    pendingTypeKeys: [],
  },
  {
    code: 'D-ROOF',
    guide: guide(2, '23', 'Roof area'),
    state: 'provisional',
    inputs: [{ label: 'Roof area', value: 1712, unit: 'm²', source: 'geometry', dbIds: ROOFS }],
    gaps: [],
    pendingTypeKeys: [MOCK_PENDING[2].typeKey],
  },
  {
    code: 'AU-SKYLIGHT',
    guide: guide(8, '36', 'Skylight share of roof'),
    state: 'provisional',
    inputs: [{ label: 'Skylight share of roof area', value: 2.1, unit: '%', source: 'geometry', dbIds: SKYLIGHTS }],
    gaps: [],
    pendingTypeKeys: [],
  },
  {
    code: 'EEM01',
    guide: guide(3, '11-15', 'Reduced window to wall ratio'),
    state: 'provisional',
    inputs: [{ label: 'Window to wall ratio, whole building', value: 25.8, unit: '%', source: 'geometry' }],
    orientations: MOCK_ORIENTATIONS,
    gaps: [],
    pendingTypeKeys: [MOCK_PENDING[0].typeKey, MOCK_PENDING[1].typeKey],
  },
  {
    code: 'EEM02',
    guide: guide(3, '16-20', 'Reflective paint and tiles for roofs and external walls'),
    state: 'blocked',
    inputs: [],
    gaps: gaps.filter((g) => g.measure === 'EEM02'),
    pendingTypeKeys: [],
  },
  {
    code: 'EEM09',
    guide: guide(3, '43-46', 'Insulation of roof'),
    state: 'provisional',
    inputs: [],
    gaps: gaps.filter((g) => g.measure === 'EEM09'),
    pendingTypeKeys: [],
  },
]

export const MOCK_RUN: RunResult = {
  runId: 'mock-210king-001',
  state: 'provisional',
  guideVersion: 'V3.1',
  snapshot: {
    modelUrn: 'mock',
    viewableGuid: 'mock',
    viewableName: 'New Construction',
    units: 'ft',
    north: { source: 'project', angleDeg: 0 },
    takenAt: '2026-10-21T04:00:00Z',
  },
  classifications: [...confirmedRules, ...MOCK_PENDING],
  exclusions: MOCK_EXCLUSIONS,
  measures,
  computedAt: '2026-10-21T04:00:02Z',
}

export const MOCK_DELAY_MS = 1400

/** Stands in for the measurement engine until unit 2 and 3 land. */
export function loadMockRun(signal?: AbortSignal): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(structuredClone(MOCK_RUN)), MOCK_DELAY_MS)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })
}
