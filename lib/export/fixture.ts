import type { GuideRef, MeasureResult, OrientationRow, RunResult } from '@/lib/edge/types'
import type { PackMeta } from './manifest'

const GUIDE_URL = 'https://edgebuildings.com/'

const guide = (part: GuideRef['part'], page: string, title: string): GuideRef => ({
  part,
  page,
  title,
  url: GUIDE_URL,
})

const row = (
  orientation: OrientationRow['orientation'],
  wallAreaM2: number,
  glazingAreaM2: number,
  wallDbIds: number[],
  glazingDbIds: number[],
): OrientationRow => ({
  orientation,
  wallDbIds,
  glazingDbIds,
  wallAreaM2,
  glazingAreaM2,
  wwr: wallAreaM2 === 0 ? null : glazingAreaM2 / wallAreaM2,
})

const orientations: OrientationRow[] = [
  row('N', 2840.5, 1250.2, [1201, 1202, 1203, 1204], [3101, 3102, 3103]),
  row('NE', 0, 0, [], []),
  row('E', 1420.25, 560.8, [1210, 1211], [3110, 3111]),
  row('SE', 310.4, 95.3, [1215], [3115]),
  row('S', 2790.0, 1480.6, [1220, 1221, 1222, 1223], [3120, 3121, 3122, 3123]),
  row('SW', 0, 0, [], []),
  row('W', 1395.75, 420.1, [1230, 1231], [3130, 3131]),
  row('NW', 280.6, 60.0, [1235], [3135]),
]

const totalWall = orientations.reduce((s, o) => s + o.wallAreaM2, 0)
const totalGlazing = orientations.reduce((s, o) => s + o.glazingAreaM2, 0)

const designGuide = guide(2, '9', 'Building Data')

const measures: MeasureResult[] = [
  {
    code: 'D-GIA',
    guide: designGuide,
    state: 'ok',
    inputs: [{ label: 'Gross Internal Area', value: 18450.3, unit: 'm2', source: 'rooms' }],
    gaps: [],
    pendingTypeKeys: [],
  },
  {
    code: 'D-FLOORS',
    guide: designGuide,
    state: 'ok',
    inputs: [
      { label: 'Floors above grade', value: 12, unit: 'count', source: 'levels' },
      { label: 'Floors below grade', value: 1, unit: 'count', source: 'levels' },
    ],
    gaps: [],
    pendingTypeKeys: [],
  },
  {
    code: 'D-F2F',
    guide: designGuide,
    state: 'ok',
    inputs: [{ label: 'Area-weighted floor to floor height', value: 3.85, unit: 'm', source: 'levels' }],
    gaps: [],
    pendingTypeKeys: [],
  },
  {
    code: 'D-ROOF',
    guide: designGuide,
    state: 'ok',
    inputs: [{ label: 'Aggregate roof area', value: 1620.9, unit: 'm2', source: 'geometry', dbIds: [5001, 5002] }],
    gaps: [],
    pendingTypeKeys: [],
  },
  {
    code: 'EEM01',
    guide: guide(3, '14', 'EEM01 Window to Wall Ratio'),
    state: 'ok',
    inputs: [
      { label: 'Overall exposed gross facade area', value: totalWall, unit: 'm2', source: 'geometry' },
      { label: 'Overall external glazing area including frames', value: totalGlazing, unit: 'm2', source: 'geometry' },
      { label: 'Area-weighted WWR', value: (100 * totalGlazing) / totalWall, unit: '%', source: 'geometry' },
    ],
    orientations,
    gaps: [],
    pendingTypeKeys: [],
  },
  {
    code: 'EEM02',
    guide: guide(3, '21', 'EEM02 Reflective Roof'),
    state: 'blocked',
    inputs: [
      { label: 'Roof area by finish type', value: 1620.9, unit: 'm2', source: 'geometry', dbIds: [5001, 5002] },
      { label: 'Solar Reflectance Index', value: null, unit: 'SRI', source: 'parameter' },
    ],
    gaps: [
      {
        id: 'gap-eem02-sri',
        measure: 'EEM02',
        typeKey: 'Basic Roof:Membrane 150mm',
        dbIds: [5001, 5002],
        missing: 'Solar Reflectance Index',
        severity: 'needs-data-sheet',
        message: 'The roof type carries no SRI. A manufacturer data sheet is needed unless the finish is white.',
      },
    ],
    pendingTypeKeys: [],
  },
  {
    code: 'EEM09',
    guide: guide(3, '52', 'EEM09 Efficiency of Glass'),
    state: 'provisional',
    inputs: [
      { label: 'Glass area, CW-1 Vision', value: 2890.4, unit: 'm2', source: 'geometry' },
      { label: 'Centre of glass U, CW-1 Vision', value: 1.6, unit: 'W/m2K', source: 'parameter' },
      { label: 'SHGC, CW-1 Vision', value: null, unit: 'ratio', source: 'parameter' },
      { label: 'Glass area, W-2 Punched', value: 976.6, unit: 'm2', source: 'geometry' },
      { label: 'Visible transmittance, W-2 Punched', value: null, unit: 'ratio', source: 'parameter' },
    ],
    gaps: [
      {
        id: 'gap-eem09-shgc',
        measure: 'EEM09',
        typeKey: 'Curtain Wall:CW-1 Vision',
        dbIds: [3101, 3102, 3120, 3121],
        missing: 'Solar Heat Gain Coefficient',
        severity: 'blocks-claim',
        message: 'EEM09 is mandatory and needs the SHGC of every glass type from the manufacturer data sheet.',
      },
      {
        id: 'gap-eem09-vt',
        measure: 'EEM09',
        typeKey: 'Windows:W-2 Punched',
        dbIds: [3110, 3111, 3130, 3131],
        missing: 'Visible Transmittance',
        severity: 'needs-data-sheet',
        message: 'The window type carries no visible transmittance.',
      },
    ],
    pendingTypeKeys: [],
  },
  {
    code: 'AU-SKYLIGHT',
    guide: guide(3, '88', 'EEM25 Skylights'),
    state: 'ok',
    inputs: [
      { label: 'Skylight area', value: 42.8, unit: 'm2', source: 'geometry', dbIds: [6001] },
      { label: 'Skylight share of roof area', value: 2.64, unit: '%', source: 'mixed' },
    ],
    gaps: [],
    pendingTypeKeys: [],
  },
]

export const fixtureRun: RunResult = {
  runId: 'run-210king-0001',
  state: 'confirmed',
  guideVersion: 'V3.1',
  snapshot: {
    modelUrn: 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Z3JlZW5yLzIxMF9LaW5nX0FyY2gucnZ0',
    viewableGuid: '8f2a3c1e-4b6d-4e0f-9a7b-2c5d6e7f8a90',
    viewableName: 'New Construction',
    units: 'ft',
    north: { source: 'project', angleDeg: 0 },
    takenAt: '2026-10-21T14:02:11.000Z',
  },
  classifications: [
    { typeKey: 'Basic Wall:EXT-1 Precast', role: 'exterior-wall', source: 'rule', confidence: 1, reason: 'Function = Exterior' },
    { typeKey: 'Curtain Wall:CW-1 Vision', role: 'curtain-glazed', source: 'rule', confidence: 1, reason: 'Curtain panel, glazed' },
    { typeKey: 'Windows:W-2 Punched', role: 'window', source: 'rule', confidence: 1, reason: 'Category Windows' },
    { typeKey: 'Basic Roof:Membrane 150mm', role: 'roof', source: 'rule', confidence: 1, reason: 'Category Roofs' },
    { typeKey: 'Mass:Context Massing', role: 'massing', source: 'model', confidence: 0.94, reason: 'Mass category, no Function' },
  ],
  exclusions: [
    {
      id: 'excl-massing',
      dbIds: [9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008, 9009, 9010, 9011, 9012],
      reason: 'massing',
      source: 'agent',
      confirmed: true,
      note: 'Context massing of neighbouring buildings',
    },
    {
      id: 'excl-p1',
      dbIds: Array.from({ length: 86 }, (_, i) => 7001 + i),
      reason: 'below-grade',
      source: 'agent',
      confirmed: true,
      note: 'Level P1 walls, more than 50% below ground',
    },
  ],
  measures,
  computedAt: '2026-10-21T14:02:48.000Z',
}

export const fixtureMeta: PackMeta = {
  projectName: '210 King',
  modelName: '210_King_Arch.rvt',
  author: 'greenr for contact@bimframe.co',
  appVersion: '0.1.0',
  generatedAt: '2026-10-21T14:03:00.000Z',
}
