import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ProjectViewer } from '@/components/viewer/project-viewer'
import { ViewerBridgeProvider } from '@/components/viewer/viewer-bridge'
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
  const view = viewableName(model)

  return (
    <ViewerBridgeProvider>
      <div className="flex h-dvh flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            greenr
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="truncate text-sm font-medium" data-testid="model-name">
            {model.name}
          </h1>
          {view ? <span className="font-mono text-xs text-muted-foreground">{view}</span> : null}
          <div className="ml-auto">
            <Button disabled size="sm" data-testid="check-edge">
              Check for EDGE
            </Button>
          </div>
        </header>
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize="70%" minSize={320} className="min-w-0">
            <ProjectViewer urn={model.urn} viewableName={view} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={380} minSize={280} maxSize={640} className="min-w-0">
            <aside
              data-testid="edge-panel"
              className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground"
            >
              Run a check to see EDGE inputs
            </aside>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </ViewerBridgeProvider>
  )
}
