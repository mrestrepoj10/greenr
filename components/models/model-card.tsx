import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { viewableName } from '@/lib/models/catalog'
import type { BucketModel, TranslationStatus } from '@/lib/models/types'

const STATUS_VARIANT: Record<TranslationStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  success: 'default',
  inprogress: 'secondary',
  pending: 'outline',
  failed: 'destructive',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : 'unknown date'
}

export function ModelCard({ model }: { model: BucketModel }) {
  const view = viewableName(model)
  const openable = model.translation === 'success' && view
  const body = (
    <Card className="h-full transition-colors hover:border-foreground/40" data-testid="model-card">
      <CardHeader>
        <CardTitle className="truncate text-base" title={model.objectKey}>
          {model.name}
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[model.translation]}>{model.translation}</Badge>
          <span className="tabular-nums">{formatBytes(model.sizeBytes)}</span>
          <span className="tabular-nums">{formatDate(model.modifiedAt)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {view ? (
          <span>
            View <span className="text-foreground">{view}</span>
            {' of '}
            {model.viewables.filter((v) => v.role === '3d').length} 3D
          </span>
        ) : (
          <span>No translated 3D view</span>
        )}
      </CardContent>
    </Card>
  )
  return openable ? (
    <Link href={`/p/${model.slug}`} className="block focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-xl">
      {body}
    </Link>
  ) : (
    <div className="opacity-60">{body}</div>
  )
}
