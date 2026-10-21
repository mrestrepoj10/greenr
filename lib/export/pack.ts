import { zipSync, type Zippable } from 'fflate'
import type { RunResult } from '@/lib/edge/types'
import { inputsCsv } from './csv'
import {
  MANIFEST_FILE_NAME,
  SCHEME_EXPORT,
  buildManifest,
  documentFileName,
  elevationFileName,
  type PackManifest,
  type PackMeta,
} from './manifest'
import { measurePdf, type ElevationImage } from './pdf'

export type Pack = { zip: Uint8Array; manifest: PackManifest }

const encoder = new TextEncoder()

/** Entry order is manifest, one CSV per scheme, one PDF per measure in run order, then elevations, so two packs from the same run list identically. */
export async function buildPack(run: RunResult, images: ElevationImage[], meta: PackMeta): Promise<Pack> {
  const stamped: PackMeta = { ...meta, generatedAt: meta.generatedAt ?? new Date().toISOString() }
  const manifest = buildManifest(run, stamped, images.map((i) => i.label))
  const mtime = new Date(manifest.generatedAt)
  const text = { level: 6, mtime } as const
  const binary = { level: 0, mtime } as const

  const entries: Zippable = {
    [MANIFEST_FILE_NAME]: [encoder.encode(JSON.stringify(manifest, null, 2)), text],
  }
  for (const scheme of run.schemes) entries[SCHEME_EXPORT[scheme].csvFileName] = [encoder.encode(inputsCsv(run, scheme)), text]
  for (const measure of run.measures) {
    const fileName = documentFileName(measure.code, stamped.version ?? 1, 'pdf')
    entries[fileName] = [await measurePdf(run, measure.code, images, stamped), text]
  }
  for (const image of images) entries[elevationFileName(image.label)] = [image.png, binary]

  return { zip: zipSync(entries), manifest }
}
