import { ORIENTATIONS, type OrientationRow, type RunResult } from '@/lib/edge/types'
import { formatValue } from './manifest'

export const DESIGN_INPUTS_HEADER = ['measure', 'label', 'value', 'unit', 'source', 'guide_doc', 'guide_page'] as const

export const EEM01_HEADER = [
  'measure',
  'orientation',
  'wall_area_m2',
  'glazing_area_m2',
  'wwr_percent',
  'source',
  'guide_doc',
  'guide_page',
] as const

const EMPTY_ROW: Omit<OrientationRow, 'orientation'> = {
  wallDbIds: [],
  glazingDbIds: [],
  wallAreaM2: 0,
  glazingAreaM2: 0,
  wwr: null,
}

const twoDecimals = (n: number): string => n.toFixed(2)

function cell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function line(cells: readonly string[]): string {
  return cells.map(cell).join(',')
}

/** The EEM01 calculator takes one row per orientation. A missing façade is an explicit zero, never a blank, so the EDGE App does not fall back to defaults. */
export function eem01Rows(run: RunResult): string[][] {
  const measure = run.measures.find((m) => m.code === 'EEM01')
  const byOrientation = new Map(measure?.orientations?.map((o) => [o.orientation, o]) ?? [])
  return ORIENTATIONS.map((orientation) => {
    const o = byOrientation.get(orientation) ?? { ...EMPTY_ROW, orientation }
    return [
      'EEM01',
      orientation,
      twoDecimals(o.wallAreaM2),
      twoDecimals(o.glazingAreaM2),
      twoDecimals((o.wwr ?? 0) * 100),
      'geometry',
      measure?.guide.doc ?? '',
      measure?.guide.page ?? '',
    ]
  })
}

export function designInputRows(run: RunResult): string[][] {
  return run.measures.flatMap((m) =>
    m.inputs.map((input) => [
      m.code,
      input.label,
      formatValue(input.value),
      input.unit,
      input.source,
      m.guide.doc,
      m.guide.page,
    ]),
  )
}

export function edgeInputsCsv(run: RunResult): string {
  const lines = [
    line(DESIGN_INPUTS_HEADER),
    ...designInputRows(run).map(line),
    '',
    line(EEM01_HEADER),
    ...eem01Rows(run).map(line),
  ]
  return lines.join('\r\n') + '\r\n'
}
