import type { Exclusion, InputValue, MeasureBlocker, MeasureCode, RunResult, Scheme, Snapshot } from '@/lib/edge/types'
import { messages } from '@/lib/ui/messages'

export type SchemeExport = {
  name: string
  inputsHeading: string
  enteredNote: string
  disclaimer: string
  csvFileName: string
  csvTitle: string
}

export const SCHEME_EXPORT: Record<Scheme, SchemeExport> = {
  EDGE: {
    name: 'EDGE',
    inputsHeading: 'Inputs for the EDGE App',
    enteredNote: 'Highlighted cells are the values entered in the EDGE App.',
    disclaimer: 'Inputs only. Savings are calculated in the EDGE App.',
    csvFileName: 'edge-inputs.csv',
    csvTitle: 'EDGE App inputs',
  },
  CASA: {
    name: 'CASA Colombia',
    inputsHeading: 'Inputs for the CASA Colombia pre-check',
    enteredNote: 'Highlighted cells are the values carried into the CASA calculators and the MS&C form.',
    disclaimer: 'Pre-check only. Credits are awarded by CCCS/GBCI on the Arc platform.',
    csvFileName: 'casa-inputs.csv',
    csvTitle: 'CASA Colombia pre-check inputs',
  },
}

export const MEASURE_TITLES: Record<MeasureCode, string> = {
  'D-GIA': 'Gross Internal Area',
  'D-FLOORS': 'Floors Above and Below Grade',
  'D-F2F': 'Floor to Floor Height',
  'D-ROOF': 'Aggregate Roof Area',
  EEM01: 'Window to Wall Ratio',
  EEM02: 'Reflective Roof',
  EEM09: 'Efficiency of Glass',
  'AU-SKYLIGHT': 'Skylight Share of Roof Area',
  'C-ENV': 'Envelope Sheet',
  'C-FLOOD': 'Flood and Road Grade',
  'C-VENT': 'Natural Ventilation and Daylight',
  'C-WATER': 'Water Fixtures',
  'C-FLEX': 'Non-structural Partitions',
  'C-SRI': 'Roof Solar Reflectance',
  'C-GLAZE': 'Glazing Light Transmittance',
}

export const MANIFEST_FILE_NAME = 'manifest.json'
export const ELEVATIONS_DIR = 'elevations'

export type PackMeta = {
  projectName: string
  modelName: string
  author: string
  appVersion: string
  /** Document version NN in every file name. Defaults to 1. */
  version?: number
  /** ISO timestamp. Defaults to now. */
  generatedAt?: string
}

export type DocumentKind = 'pdf' | 'csv' | 'png' | 'json'

export type PackDocument = {
  fileName: string
  measure: MeasureCode | 'pack'
  kind: DocumentKind
  title: string
  version: number
}

/** One row per entered value in the Part 8 audit trail shape: parameter, value and unit, file, page. */
export type ParameterRef = {
  measure: MeasureCode
  label: string
  value: string
  unit: string
  fileName: string
  page: number
  guideDoc: string
  guidePage: string
}

export type PackManifest = {
  generatedAt: string
  runId: string
  projectName: string
  modelName: string
  modelUrn: string
  viewableName: string
  snapshotTakenAt: string
  author: string
  appVersion: string
  schemes: Scheme[]
  guides: Record<Scheme, string>
  north: string
  exclusions: string[]
  documents: PackDocument[]
  parameters: ParameterRef[]
  disclaimer: string
}

export function slugTitle(title: string): string {
  return title.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function documentFileName(measure: MeasureCode, version: number, ext: DocumentKind): string {
  return `${measure}_${slugTitle(MEASURE_TITLES[measure])}-${String(version).padStart(2, '0')}.${ext}`
}

export function elevationFileName(label: string): string {
  return `${ELEVATIONS_DIR}/${slugTitle(label)}.png`
}

export function formatValue(value: InputValue['value']): string {
  if (value === null) return ''
  if (typeof value === 'number') return value.toFixed(2)
  return value
}

export function describeNorth(north: Snapshot['north']): string {
  const source = {
    project: 'Project north',
    'true-north-param': 'True north from the model parameter',
    user: 'North set by the user',
  }[north.source]
  return `${source}, ${north.angleDeg.toFixed(1)} degrees clockwise from the model +Y axis. Orientations are the closest of eight 45 degree sectors.`
}

export function describeBlocker(blocker: MeasureBlocker): string {
  return blocker.kind === 'missing-input'
    ? `needs the project input ${messages.projectInputs.fields[blocker.input].label}`
    : 'not measured in this version of greenr'
}

export function describeExclusion(exclusion: Exclusion): string {
  const note = exclusion.note ? `, ${exclusion.note}` : ''
  return `${exclusion.reason}: ${exclusion.dbIds.length} elements, ${exclusion.status} (${exclusion.source})${note}`
}

export function buildManifest(run: RunResult, meta: PackMeta, imageLabels: string[] = []): PackManifest {
  const version = meta.version ?? 1
  const documents: PackDocument[] = [
    { fileName: MANIFEST_FILE_NAME, measure: 'pack', kind: 'json', title: 'Evidence pack manifest', version },
    ...run.schemes.map((scheme) => ({
      fileName: SCHEME_EXPORT[scheme].csvFileName,
      measure: 'pack' as const,
      kind: 'csv' as const,
      title: SCHEME_EXPORT[scheme].csvTitle,
      version,
    })),
    ...run.measures.map((m) => ({
      fileName: documentFileName(m.code, version, 'pdf'),
      measure: m.code,
      kind: 'pdf' as const,
      title: `${m.code} ${MEASURE_TITLES[m.code]}`,
      version,
    })),
    ...imageLabels.map((label) => ({
      fileName: elevationFileName(label),
      measure: 'pack' as const,
      kind: 'png' as const,
      title: label,
      version,
    })),
  ]
  const parameters: ParameterRef[] = run.measures.flatMap((m) =>
    m.inputs.map((input) => ({
      measure: m.code,
      label: input.label,
      value: formatValue(input.value),
      unit: input.unit,
      fileName: documentFileName(m.code, version, 'pdf'),
      page: 1,
      guideDoc: m.guide.doc,
      guidePage: m.guide.page,
    })),
  )
  return {
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    runId: run.runId,
    projectName: meta.projectName,
    modelName: meta.modelName,
    modelUrn: run.snapshot.modelUrn,
    viewableName: run.snapshot.viewableName,
    snapshotTakenAt: run.snapshot.takenAt,
    author: meta.author,
    appVersion: meta.appVersion,
    schemes: run.schemes,
    guides: run.guides,
    north: describeNorth(run.snapshot.north),
    exclusions: run.exclusions.map(describeExclusion),
    documents,
    parameters,
    disclaimer: run.schemes.map((scheme) => SCHEME_EXPORT[scheme].disclaimer).join(' '),
  }
}
