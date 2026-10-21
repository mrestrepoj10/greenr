import type {
  Classification,
  Exclusion,
  Gap,
  MeasureResult,
  OrientationRow,
  RunResult,
} from '@/lib/edge/types'
import type {
  StoredClassification,
  StoredExclusion,
  StoredMeasure,
  StoredRunElement,
  StoredRunFields,
} from '@/convex/validators'

export const CHUNK_SIZE = 8000

export type RunElementChunk = Pick<StoredRunElement, 'key' | 'chunk' | 'dbIds'>
export type StoredRun = Omit<StoredRunFields, '_id' | '_creationTime' | 'projectId'>
export type ClassificationRow = Omit<StoredClassification, '_id' | '_creationTime' | 'projectId' | 'updatedAt'>
export type ExclusionRow = Omit<StoredExclusion, '_id' | '_creationTime' | 'projectId' | 'updatedAt'>

export type StoredRunBundle = {
  run: StoredRun
  elements: RunElementChunk[]
  classifications: ClassificationRow[]
  exclusions: ExclusionRow[]
}

export const orientationKey = (code: MeasureResult['code'], o: OrientationRow['orientation'], side: 'wall' | 'glazing') =>
  `${code}:orientation:${o}:${side}`
export const gapKey = (id: Gap['id']) => `gap:${id}`

function chunksFor(key: string, dbIds: number[]): RunElementChunk[] {
  if (dbIds.length === 0) return [{ key, chunk: 0, dbIds: [] }]
  const out: RunElementChunk[] = []
  for (let i = 0; i < dbIds.length; i += CHUNK_SIZE) {
    out.push({ key, chunk: out.length, dbIds: dbIds.slice(i, i + CHUNK_SIZE) })
  }
  return out
}

export function toExclusionRow(e: Exclusion): ExclusionRow {
  const { confirmed, note, ...rest } = e
  return { ...rest, status: confirmed ? 'accepted' : 'proposed', ...(note === undefined ? {} : { note }) }
}

/** Picks the exclusion's own fields, so a Convex document's _id, _creationTime and projectId never ride along. */
export function fromExclusionRow(row: ExclusionRow): Exclusion {
  const { id, dbIds, reason, source, status, note } = row
  return { id, dbIds, reason, source, confirmed: status === 'accepted', ...(note === undefined ? {} : { note }) }
}

export function toClassificationRow(c: Classification): ClassificationRow {
  return { typeKey: c.typeKey, role: c.role, source: c.source, confidence: c.confidence, reason: c.reason }
}

export function fromClassificationRow(row: ClassificationRow): Classification {
  return { typeKey: row.typeKey, role: row.role, source: row.source, confidence: row.confidence, reason: row.reason }
}

export function toStoredRun(run: RunResult): StoredRunBundle {
  const elements: RunElementChunk[] = []
  let elementCount = 0
  const push = (key: string, dbIds: number[]) => {
    elementCount += dbIds.length
    elements.push(...chunksFor(key, dbIds))
  }
  const measures: StoredMeasure[] = run.measures.map((m) => {
    const orientations = m.orientations?.map((o) => {
      push(orientationKey(m.code, o.orientation, 'wall'), o.wallDbIds)
      push(orientationKey(m.code, o.orientation, 'glazing'), o.glazingDbIds)
      return { orientation: o.orientation, wallAreaM2: o.wallAreaM2, glazingAreaM2: o.glazingAreaM2, wwr: o.wwr }
    })
    const gaps = m.gaps.map((g) => {
      push(gapKey(g.id), g.dbIds)
      return { id: g.id, measure: g.measure, typeKey: g.typeKey, missing: g.missing, severity: g.severity, message: g.message }
    })
    return {
      code: m.code,
      guide: m.guide,
      state: m.state,
      inputs: m.inputs,
      ...(orientations === undefined ? {} : { orientations }),
      gaps,
      pendingTypeKeys: m.pendingTypeKeys,
    }
  })
  return {
    run: {
      runId: run.runId,
      state: run.state,
      guideVersion: run.guideVersion,
      snapshot: run.snapshot,
      measures,
      computedAt: run.computedAt,
      elementCount,
    },
    elements,
    classifications: run.classifications.map(toClassificationRow),
    exclusions: run.exclusions.map(toExclusionRow),
  }
}

export function assembleElements(elements: RunElementChunk[]): Map<string, number[]> {
  const byKey = new Map<string, RunElementChunk[]>()
  for (const e of elements) {
    const list = byKey.get(e.key) ?? []
    list.push(e)
    byKey.set(e.key, list)
  }
  const out = new Map<string, number[]>()
  for (const [key, chunks] of byKey) {
    chunks.sort((a, b) => a.chunk - b.chunk)
    out.set(key, chunks.flatMap((c) => c.dbIds))
  }
  return out
}

export function fromStoredRun(
  doc: StoredRun,
  elements: RunElementChunk[],
  classifications: ClassificationRow[],
  exclusions: ExclusionRow[],
): RunResult {
  const ids = assembleElements(elements)
  const idsFor = (key: string) => ids.get(key) ?? []
  const measures: MeasureResult[] = doc.measures.map((m) => ({
    code: m.code,
    guide: m.guide,
    state: m.state,
    inputs: m.inputs,
    ...(m.orientations === undefined
      ? {}
      : {
          orientations: m.orientations.map((o) => ({
            ...o,
            wallDbIds: idsFor(orientationKey(m.code, o.orientation, 'wall')),
            glazingDbIds: idsFor(orientationKey(m.code, o.orientation, 'glazing')),
          })),
        }),
    gaps: m.gaps.map((g) => ({ ...g, dbIds: idsFor(gapKey(g.id)) })),
    pendingTypeKeys: m.pendingTypeKeys,
  }))
  return {
    runId: doc.runId,
    state: doc.state,
    guideVersion: doc.guideVersion,
    snapshot: doc.snapshot,
    classifications: classifications.map(fromClassificationRow),
    exclusions: exclusions.filter((row) => row.status !== 'rejected').map(fromExclusionRow),
    measures,
    computedAt: doc.computedAt,
  }
}
