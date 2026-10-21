import { apsGet, pathSegment } from '@/lib/aps/token'

const SCOPES = ['bucket:read', 'data:read'] as const

export interface OssObject {
  objectKey: string
  size: number
}

interface ObjectsPage {
  items?: Partial<OssObject>[]
  next?: string
}

/** Every object in the bucket, following `next` links until the listing ends. */
export async function listObjects(bucket: string): Promise<OssObject[]> {
  const objects: OssObject[] = []
  let path: string | null = `/oss/v2/buckets/${pathSegment(bucket)}/objects?limit=100`
  while (path) {
    const page: ObjectsPage | null = await apsGet<ObjectsPage>(path, SCOPES)
    if (!page) break
    for (const item of page.items ?? []) {
      if (item.objectKey) {
        objects.push({
          objectKey: item.objectKey,
          size: item.size ?? 0,
        })
      }
    }
    path = page.next ? new URL(page.next).pathname + new URL(page.next).search : null
  }
  return objects
}
