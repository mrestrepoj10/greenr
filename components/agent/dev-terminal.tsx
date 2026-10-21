'use client'

import { X } from 'lucide-react'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { GreenrTools } from '@/components/agent/edge-agent'
import { Button } from '@/components/ui/button'
import { FxTerminal } from '@/components/ui/fx-terminal'
import { GREENR_INSTRUCTIONS } from '@/lib/agent/instructions'
import { DEFAULT_AGENT_MODEL, GATEWAY_BASE } from '@/lib/agent/models'
import { ASK_USER_QUESTION } from '@/lib/agent/question'
import { messages } from '@/lib/ui/messages'
import { installDevHook } from '@/lib/viewer/dev-hook'
import type { APSViewer3D } from '@/lib/viewer-types'

/** Developer mode: on with ?dev=1 in the URL, toggled with Ctrl+` (backquote). */
const onDevKey = (event: KeyboardEvent) => {
  if (event.ctrlKey && (event.key === '`' || event.code === 'Backquote')) {
    event.preventDefault()
    devMode.set(!devMode.get())
  }
}

const devMode = {
  on: null as boolean | null,
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    if (devMode.listeners.size === 0) window.addEventListener('keydown', onDevKey, true)
    devMode.listeners.add(listener)
    return () => {
      devMode.listeners.delete(listener)
      if (devMode.listeners.size === 0) window.removeEventListener('keydown', onDevKey, true)
    }
  },
  get(): boolean {
    devMode.on ??= new URLSearchParams(window.location.search).get('dev') === '1'
    return devMode.on
  },
  set(on: boolean) {
    devMode.on = on
    for (const listener of devMode.listeners) listener()
  },
}

export function useDevMode(): boolean {
  return useSyncExternalStore(devMode.subscribe, devMode.get, () => false)
}

/** The fx terminal over the bottom of the stage, running the same tools as the assistant, as `viewer <tool>` commands. */
export function DevTerminal({ greenr }: { greenr: GreenrTools }) {
  const tools = useMemo(
    () => ({
      ...greenr.kit,
      // A terminal has no panel to answer in, so the question tool stays with the chat assistant.
      tools: greenr.registry.asAgentTools().filter((tool) => tool.name !== ASK_USER_QUESTION),
      instructions: GREENR_INSTRUCTIONS,
    }),
    [greenr],
  )
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex h-[42%] flex-col border-t bg-background" data-testid="dev-terminal">
      <header className="flex h-8 shrink-0 items-center px-3 font-mono text-xs text-muted-foreground">
        {messages.dev.terminal}
        <Button size="icon-xs" variant="ghost" className="ml-auto" onClick={() => devMode.set(false)} aria-label={messages.dev.close}>
          <X aria-hidden />
        </Button>
      </header>
      <FxTerminal tools={tools} gatewayBase={GATEWAY_BASE} model={DEFAULT_AGENT_MODEL} className="min-h-0 flex-1" />
    </div>
  )
}

/** window.__greenr in development builds and in developer mode: readSnapshot, computeRun, proposeExclusions. */
export function useDevHook(viewer: APSViewer3D | null, ready: boolean, on: boolean) {
  useEffect(() => {
    if (!viewer || !ready || !(on || process.env.NODE_ENV === 'development')) return
    installDevHook(viewer)
    return () => {
      delete window.__greenr
    }
  }, [viewer, ready, on])
}
