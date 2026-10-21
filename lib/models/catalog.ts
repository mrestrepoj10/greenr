import type { Manifest, ManifestNode } from '@/lib/aps/derivative'
import type { OssObject } from '@/lib/aps/oss'
import type { BucketModel, TranslationStatus, Viewable } from '@/lib/models/types'

const MODEL_EXTENSIONS = ['.rvt', '.ifc', '.nwd']
const ISSUED_OBJECT_KEY = /^(?:[0-9a-f-]{36}|bimscripts)--(.+)$/i
const STATUSES: readonly TranslationStatus[] = ['pending', 'inprogress', 'success', 'failed']

export const PREFERRED_VIEW_NAME = 'New Construction'

export function isModelFile(objectKey: string): boolean {
  const lower = objectKey.toLowerCase()
  return MODEL_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function displayName(objectKey: string): string {
  return ISSUED_OBJECT_KEY.exec(objectKey)?.[1] ?? objectKey
}

export function slugFor(objectKey: string): string {
  return Buffer.from(objectKey, 'utf8').toString('base64url')
}

export function objectKeyFor(slug: string): string {
  return Buffer.from(slug, 'base64url').toString('utf8')
}

export function translationStatus(manifest: Manifest | null): TranslationStatus {
  if (!manifest) return 'pending'
  if (manifest.status === 'timeout') return 'failed'
  return STATUSES.find((s) => s === manifest.status) ?? 'pending'
}

function walk(nodes: ManifestNode[] | undefined, out: Viewable[]): Viewable[] {
  for (const node of nodes ?? []) {
    if (node.type === 'geometry' && node.guid && (node.role === '3d' || node.role === '2d')) {
      out.push({
        guid: node.guid,
        name: node.name ?? node.guid,
        role: node.role,
        isMasterView: node.isMasterView === true,
      })
    }
    walk(node.children, out)
  }
  return out
}

export function viewablesOf(manifest: Manifest | null): Viewable[] {
  return walk(manifest?.derivatives, [])
}

/** Ranked preference for which 3D viewable to open. The master view is the
 * Revit view that carries Rooms, which the default `{3D}` view drops. */
const VIEWABLE_PREFERENCE: readonly ((v: Viewable) => boolean)[] = [
  (v) => v.name.toLowerCase() === PREFERRED_VIEW_NAME.toLowerCase(),
  (v) => v.isMasterView,
  (v) => v.name === '{3D}',
  () => true,
]

export function preferredViewable(viewables: Viewable[]): Viewable | undefined {
  const threeD = viewables.filter((v) => v.role === '3d')
  for (const rule of VIEWABLE_PREFERENCE) {
    const hit = threeD.find(rule)
    if (hit) return hit
  }
  return undefined
}

export function toBucketModel(object: OssObject, urn: string, manifest: Manifest | null): BucketModel {
  const viewables = viewablesOf(manifest)
  return {
    objectKey: object.objectKey,
    slug: slugFor(object.objectKey),
    urn,
    name: displayName(object.objectKey),
    sizeBytes: object.size,
    translation: translationStatus(manifest),
    viewables,
    preferredViewable: preferredViewable(viewables)?.guid,
  }
}

export function viewableName(model: BucketModel): string | undefined {
  return model.viewables.find((v) => v.guid === model.preferredViewable)?.name
}

export function byName(a: BucketModel, b: BucketModel): number {
  return a.name.localeCompare(b.name)
}
