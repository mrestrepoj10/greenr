import { cacheLife } from 'next/cache'
import { getManifest, objectUrn } from '@/lib/aps/derivative'
import { listObjects } from '@/lib/aps/oss'
import { bucketKey } from '@/lib/aps/token'
import { byName, isModelFile, objectKeyFor, toBucketModel } from '@/lib/models/catalog'
import type { BucketModel, ModelCatalog } from '@/lib/models/types'

const MANIFEST_CONCURRENCY = 6

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

export async function listBucketModels(): Promise<ModelCatalog> {
  'use cache'
  cacheLife({ stale: 60, revalidate: 60, expire: 300 })
  const bucket = bucketKey()
  const objects = (await listObjects(bucket)).filter((o) => isModelFile(o.objectKey))
  const models = await mapWithConcurrency(objects, MANIFEST_CONCURRENCY, async (object) => {
    const urn = objectUrn(bucket, object.objectKey)
    return toBucketModel(object, urn, await getManifest(urn))
  })
  return { bucket, models: models.sort(byName) }
}

export async function findBucketModel(slug: string): Promise<BucketModel | undefined> {
  const objectKey = objectKeyFor(slug)
  const { models } = await listBucketModels()
  return models.find((m) => m.objectKey === objectKey)
}
