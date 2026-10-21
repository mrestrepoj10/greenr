import type { Manifest, ManifestNode } from '@/lib/aps/derivative'
import type { OssObject } from '@/lib/aps/oss'
import type { BucketModel, TranslationStatus, Viewable } from '@/lib/models/types'

const MODEL_EXTENSIONS = ['.rvt', '.ifc', '.nwd']
const ISSUED_OBJECT_KEY = /^(?:[0-9a-f-]{36}|bimscripts)--(.+)$/i
const STATUSES: readonly TranslationStatus[] = ['pending', 'inprogress', 'success', 'failed']
/** Revit's default "New Construction" phase in the languages Revit ships, compared without case or accents. */
const NEW_CONSTRUCTION = /new construction|nueva construccion|nova construcao|nuova costruzione|neubau|nouvelle construction/

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

const folded = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
const isNewConstruction = (v: Viewable) => NEW_CONSTRUCTION.test(folded(v.name))

/**
 * Ranked preference for which 3D viewable to open. Revit writes one master view per phase, and only master views
 * carry Rooms, which the default `{3D}` view drops. The new-construction phase is the one to measure; failing a
 * name match, the last master view is the latest phase.
 */
const VIEWABLE_PREFERENCE: readonly ((threeD: Viewable[]) => Viewable | undefined)[] = [
  (vs) => vs.find((v) => v.isMasterView && isNewConstruction(v)),
  (vs) => vs.find(isNewConstruction),
  (vs) => vs.findLast((v) => v.isMasterView),
  (vs) => vs.find((v) => v.name === '{3D}'),
  (vs) => vs[0],
]

export function preferredViewable(viewables: Viewable[]): Viewable | undefined {
  const threeD = viewables.filter((v) => v.role === '3d')
  for (const rule of VIEWABLE_PREFERENCE) {
    const hit = rule(threeD)
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
