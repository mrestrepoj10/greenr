import { zipSync, type Zippable } from 'fflate'
import type { RunResult } from '@/lib/edge/types'
import { edgeInputsCsv } from './csv'
import {
  CSV_FILE_NAME,
  MANIFEST_FILE_NAME,
  buildManifest,
  documentFileName,
  elevationFileName,
  type PackManifest,
  type PackMeta,
} from './manifest'
import { measurePdf, type ElevationImage } from './pdf'

export type Pack = { zip: Uint8Array; manifest: PackManifest }

const encoder = new TextEncoder()

/** Façade elevations are evidence for the window-to-wall ratio, so only that measure's PDF carries them as pages. */
export const ELEVATION_MEASURE = 'EEM01'

/** Entry order is manifest, CSV, one PDF per measure in run order, then elevations, so two packs from the same run list identically. */
export async function buildPack(run: RunResult, images: ElevationImage[], meta: PackMeta): Promise<Pack> {
  const stamped: PackMeta = { ...meta, generatedAt: meta.generatedAt ?? new Date().toISOString() }
  const manifest = buildManifest(run, stamped, images.map((i) => i.label))
  const mtime = new Date(manifest.generatedAt)
  const text = { level: 6, mtime } as const
  const binary = { level: 0, mtime } as const

  const entries: Zippable = {
    [MANIFEST_FILE_NAME]: [encoder.encode(JSON.stringify(manifest, null, 2)), text],
    [CSV_FILE_NAME]: [encoder.encode(edgeInputsCsv(run)), text],
  }
  for (const measure of run.measures) {
    const fileName = documentFileName(measure.code, stamped.version ?? 1, 'pdf')
    const pages = measure.code === ELEVATION_MEASURE ? images : []
    entries[fileName] = [await measurePdf(run, measure.code, pages, stamped), text]
  }
  for (const image of images) entries[elevationFileName(image.label)] = [image.png, binary]

  return { zip: zipSync(entries), manifest }
}
