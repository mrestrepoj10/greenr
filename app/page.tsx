import { connection } from 'next/server'
import { Suspense } from 'react'
import { ModelCard } from '@/components/models/model-card'
import { Skeleton } from '@/components/ui/skeleton'
import { listBucketModels } from '@/lib/models/list'

async function ModelGrid() {
  await connection()
  const { bucket, models } = await listBucketModels()
  return (
    <>
      <p className="font-mono text-xs text-muted-foreground">
        {models.length} models in {bucket}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <ModelCard key={model.objectKey} model={model} />
        ))}
      </div>
    </>
  )
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">greenr</h1>
        <p className="text-sm text-muted-foreground">
          Pick a model to measure its EDGE design inputs.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        }
      >
        <ModelGrid />
      </Suspense>
    </main>
  )
}
