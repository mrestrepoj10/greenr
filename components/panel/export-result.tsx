'use client'

import { Check, Copy, Download, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ExportView } from '@/components/panel/use-export-pack'
import { messages } from '@/lib/ui/messages'

/** Vercel Blob serves a public file as an attachment when asked with ?download=1. */
const downloadUrl = (url: string) => `${url}${url.includes('?') ? '&' : '?'}download=1`

export function ExportResult({ view }: { view: ExportView }) {
  const [copied, setCopied] = useState(false)
  if (view.kind === 'working') {
    return (
      <div className="flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground" data-testid="export-progress" aria-live="polite">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        {view.message}
      </div>
    )
  }
  if (view.kind === 'failed') {
    return (
      <p className="border-t px-4 py-3 text-xs text-destructive" data-testid="export-failed" role="alert">
        {view.message}
      </p>
    )
  }
  const copy = async () => {
    await navigator.clipboard.writeText(view.url)
    setCopied(true)
  }
  return (
    <section className="flex flex-col gap-2 border-t px-4 py-3" data-testid="export-result">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">{messages.exportStatus.title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{messages.exportStatus.size(view.size)}</span>
      </header>
      <a
        href={view.url}
        target="_blank"
        rel="noreferrer"
        className="truncate font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        data-testid="export-link"
      >
        {view.url}
      </a>
      <div className="flex items-center gap-2">
        <Button
          size="xs"
          variant="secondary"
          nativeButton={false}
          render={<a href={downloadUrl(view.url)} data-testid="export-download" />}
        >
          <Download data-icon="inline-start" aria-hidden />
          {messages.exportStatus.download}
        </Button>
        <Button size="xs" variant="ghost" onClick={copy} data-testid="export-copy">
          {copied ? <Check data-icon="inline-start" aria-hidden /> : <Copy data-icon="inline-start" aria-hidden />}
          {copied ? messages.exportStatus.copied : messages.exportStatus.copy}
        </Button>
      </div>
    </section>
  )
}
