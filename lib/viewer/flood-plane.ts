import type { APSViewer3D } from '@/lib/viewer-types'

export const FLOOD_OVERLAY = 'greenr-flood'
const FLOOD_COLOR = 0x3b82f6
const FLOOD_OPACITY = 0.3
/** The plane reaches past the model's plan bounds by this factor, so its edge never reads as a building edge. */
const MARGIN = 1.4

type Three = typeof THREE

function three(): Three {
  const lib = (window as unknown as { THREE?: Three }).THREE
  if (!lib) throw new Error('The viewer runtime is not loaded.')
  return lib
}

/**
 * A translucent horizontal plane at `zMetres`, in the snapshot's world frame (viewer world coordinates times the
 * model's metres per unit), over the model's plan bounds. It lives in its own overlay scene, so clearing it never
 * touches the model's theming or visibility.
 */
export function showFloodPlane(viewer: APSViewer3D, zMetres: number): void {
  const model = viewer.model
  if (!model) return
  const T = three()
  hideFloodPlane(viewer)
  const box = model.getBoundingBox()
  const size = box.getSize(new T.Vector3())
  const center = box.getCenter(new T.Vector3())
  const geometry = new T.PlaneBufferGeometry(size.x * MARGIN, size.y * MARGIN)
  const material = new T.MeshBasicMaterial({ color: FLOOD_COLOR, opacity: FLOOD_OPACITY, transparent: true, side: T.DoubleSide, depthWrite: false })
  const mesh = new T.Mesh(geometry, material)
  mesh.position.set(center.x, center.y, zMetres / model.getUnitScale())
  viewer.impl.createOverlayScene(FLOOD_OVERLAY)
  viewer.impl.addOverlay(FLOOD_OVERLAY, mesh)
  viewer.impl.invalidate(false, false, true)
}

export function hideFloodPlane(viewer: APSViewer3D): void {
  if (!viewer.impl.overlayScenes?.[FLOOD_OVERLAY]) return
  viewer.impl.removeOverlayScene(FLOOD_OVERLAY)
  viewer.impl.invalidate(false, false, true)
}
