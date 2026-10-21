'use client'

import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { useAPSViewerStore, ViewerStore } from '@/components/ui/aps-viewer'
import type { APSViewer3D } from '@/lib/viewer-types'

interface BridgeState {
  store: ViewerStore | null
  setStore: (store: ViewerStore | null) => void
}

const ViewerBridgeContext = createContext<BridgeState>({ store: null, setStore: () => {} })

/** Wrap the page so siblings of <APSViewer> (the right panel, a top bar, an
 * agent) can reach the live viewer through `useViewer()`. */
export function ViewerBridgeProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ViewerStore | null>(null)
  return (
    <ViewerBridgeContext.Provider value={{ store, setStore }}>{children}</ViewerBridgeContext.Provider>
  )
}

/** Render as a child of <APSViewer>. Publishes that viewer's store to the provider above. */
export function ViewerBridge() {
  const store = useAPSViewerStore()
  const { setStore } = useContext(ViewerBridgeContext)
  useEffect(() => {
    setStore(store)
    return () => setStore(null)
  }, [store, setStore])
  return null
}

export interface ViewerHandle {
  viewer: APSViewer3D | null
  isReady: boolean
  isModelLoaded: boolean
  /** Imperative access for code outside React render, such as agent tools. */
  getViewer: () => APSViewer3D | null
}

const noSubscribe = () => () => {}

export function useViewer(): ViewerHandle {
  const { store } = useContext(ViewerBridgeContext)
  const viewer = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    store?.getViewer ?? ViewerStore.getServerViewer,
    ViewerStore.getServerViewer,
  )
  const isModelLoaded = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    store?.isModelLoaded ?? ViewerStore.getServerModelLoaded,
    ViewerStore.getServerModelLoaded,
  )
  return {
    viewer,
    isReady: viewer !== null,
    isModelLoaded,
    getViewer: store?.getViewer ?? ViewerStore.getServerViewer,
  }
}
