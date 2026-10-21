import { apsGet, pathSegment } from '@/lib/aps/token'

const SCOPES = ['data:read', 'viewables:read'] as const

export interface ManifestNode {
  type?: string
  role?: string
  name?: string
  guid?: string
  isMasterView?: boolean
  children?: ManifestNode[]
}

export interface Manifest {
  status?: string
  progress?: string
  derivatives?: ManifestNode[]
}

/** The translation manifest, or null when the URN was never translated. */
export function getManifest(urn: string): Promise<Manifest | null> {
  return apsGet<Manifest>(`/modelderivative/v2/designdata/${pathSegment(urn)}/manifest`, SCOPES)
}

export function objectUrn(bucket: string, objectKey: string): string {
  return Buffer.from(`urn:adsk.objects:os.object:${bucket}/${objectKey}`, 'utf8').toString(
    'base64url',
  )
}
