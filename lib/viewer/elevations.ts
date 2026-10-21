import type { ElevationImage } from '@/lib/export/pdf'
import type { APSViewer3D } from '@/lib/viewer-types'

export const ELEVATION_SIDES = ['N', 'E', 'S', 'W'] as const
export type ElevationSide = (typeof ELEVATION_SIDES)[number]

/** Clockwise from true north, so each side's outward direction is north turned by this many degrees. */
const SIDE_TURN: Record<ElevationSide, number> = { N: 0, E: 90, S: 180, W: 270 }

export const ELEVATION_LABELS: Record<ElevationSide, string> = {
  N: 'North elevation',
  E: 'East elevation',
  S: 'South elevation',
  W: 'West elevation',
}

/** Every elevation PNG has this size, whatever the size of the canvas on screen. */
export const ELEVATION_SIZE = { width: 1600, height: 1000 } as const

const SHOT_TIMEOUT_MS = 30_000

type Three = typeof THREE

function three(): Three {
  const lib = (window as unknown as { THREE?: Three }).THREE
  if (!lib) throw new Error('The viewer runtime is not loaded.')
  return lib
}

/** World bounds of the elements' fragments, in viewer coordinates. */
export function worldBounds(viewer: APSViewer3D, dbIds: readonly number[]): THREE.Box3 | null {
  const model = viewer.model
  if (!model) return null
  const T = three()
  const tree = model.getInstanceTree()
  const frags = model.getFragmentList()
  const box = new T.Box3()
  const part = new T.Box3()
  for (const dbId of dbIds) {
    // enumNodeFragments stops when the callback returns a truthy value, so the body must not return the union.
    tree.enumNodeFragments(
      dbId,
      (fragId: number) => {
        frags.getWorldBounds(fragId, part)
        box.union(part)
      },
      true,
    )
  }
  return box.isEmpty() ? null : box
}

/** PNG bytes of the canvas at the given size. */
export function screenshotPng(viewer: APSViewer3D, width: number, height: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The screenshot timed out.')), SHOT_TIMEOUT_MS)
    viewer.getScreenShot(width, height, (url: string) => {
      clearTimeout(timer)
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buffer) => resolve(new Uint8Array(buffer)), reject)
        .finally(() => {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url)
        })
    })
  })
}

export type ElevationOptions = {
  /** The measured building: façade walls and glazing. The camera frames these. */
  dbIds: readonly number[]
  /** Context and massing, hidden while capturing so nothing stands between the camera and a façade. */
  hide?: readonly number[]
  /** Degrees clockwise from project +Y to true north. */
  northAngleDeg: number
  onSide?: (side: ElevationSide) => void
}

/**
 * Four orthographic elevations at ELEVATION_SIZE, N, E, S, W of true north, each looking at that face of the building.
 * The person's camera, projection and visibility come back afterwards.
 */
export async function captureElevations(viewer: APSViewer3D, options: ElevationOptions): Promise<ElevationImage[]> {
  const model = viewer.model
  const box = worldBounds(viewer, options.dbIds)
  if (!model || !box) throw new Error('No façade elements to frame.')
  const T = three()
  const nav = viewer.navigation
  const saved = viewer.getState({ viewport: true })
  const wasPerspective = nav.getCamera().isPerspective
  const hidden = [...(options.hide ?? [])]
  const center = box.getCenter(new T.Vector3())
  const size = box.getSize(new T.Vector3())
  const reach = Math.max(size.x, size.y, size.z) * 3
  const up = nav.getWorldUpVector()
  const { width, height } = ELEVATION_SIZE
  const images: ElevationImage[] = []
  try {
    if (hidden.length > 0) viewer.hide(hidden)
    nav.toOrthographic()
    for (const side of ELEVATION_SIDES) {
      options.onSide?.(side)
      const a = ((options.northAngleDeg + SIDE_TURN[side]) * Math.PI) / 180
      const position = new T.Vector3(center.x + Math.sin(a) * reach, center.y + Math.cos(a) * reach, center.z)
      nav.setView(position, center.clone())
      nav.setCameraUpVector(up)
      // fitToView frames for the camera's aspect, and each screenshot resets it to the canvas, so set the image's before every fit.
      nav.getCamera().aspect = width / height
      viewer.fitToView([...options.dbIds], model, true)
      images.push({ label: ELEVATION_LABELS[side], png: await screenshotPng(viewer, width, height) })
    }
  } finally {
    if (hidden.length > 0) viewer.show(hidden)
    if (wasPerspective) nav.toPerspective()
    viewer.restoreState(saved, undefined, true)
  }
  return images
}
