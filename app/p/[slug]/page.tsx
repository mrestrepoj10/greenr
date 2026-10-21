import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { ProjectWorkspace } from '@/components/viewer/project-workspace'
import { viewableName } from '@/lib/models/catalog'
import { findBucketModel } from '@/lib/models/list'

export default function ProjectPage({ params }: PageProps<'/p/[slug]'>) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Project params={params} />
    </Suspense>
  )
}

async function Project({ params }: Pick<PageProps<'/p/[slug]'>, 'params'>) {
  const { slug } = await params
  await connection()
  const model = await findBucketModel(slug)
  if (!model || model.translation !== 'success') notFound()
  return <ProjectWorkspace model={model} viewableName={viewableName(model)} />
}
