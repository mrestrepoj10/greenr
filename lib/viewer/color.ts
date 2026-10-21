import type { OrientationRow } from '@/lib/edge/types'
import type { APSViewer3D } from '@/lib/viewer-types'

declare global {
  interface Window {
    THREE?: { Vector4: new (x: number, y: number, z: number, w: number) => THREE.Vector4 }
  }
}

export type Oklch = { l: number; c: number; h: number }

/** One ramp for the viewer and the legend. WWR at or below `from` is blue, at or above `to` is red. */
export const WWR_RAMP = {
  from: 0.25,
  to: 0.7,
  low: { l: 0.68, c: 0.17, h: 255 } satisfies Oklch,
  high: { l: 0.62, c: 0.22, h: 25 } satisfies Oklch,
}

export const THEMING_INTENSITY = 0.85

/** Page background in sRGB 0..255, the dark `--background` token (oklch 0.145 0 0). */
export const STAGE_BACKGROUND: [number, number, number] = [10, 10, 10]

export function wwrStop(wwr: number): Oklch {
  const t = Math.min(1, Math.max(0, (wwr - WWR_RAMP.from) / (WWR_RAMP.to - WWR_RAMP.from)))
  const { low, high } = WWR_RAMP
  // Hue runs the long way through magenta on purpose: the short way crosses green,
  // which reads as "good" and the UI never grades a value.
  const hue = low.h + (high.h + 360 - low.h) * t
  return { l: low.l + (high.l - low.l) * t, c: low.c + (high.c - low.c) * t, h: hue % 360 }
}

export function oklchCss({ l, c, h }: Oklch): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
}

export function oklchToRgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const L = l_ ** 3
  const M = m_ ** 3
  const S = s_ ** 3
  const lin: [number, number, number] = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v))
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
  }) as [number, number, number]
}

export function wwrColorCss(wwr: number): string {
  return oklchCss(wwrStop(wwr))
}

export function legendGradientCss(): string {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    oklchCss(wwrStop(WWR_RAMP.from + t * (WWR_RAMP.to - WWR_RAMP.from))),
  )
  return `linear-gradient(to right, ${stops.join(', ')})`
}

function themingVector(rgb: [number, number, number]): THREE.Vector4 | null {
  const THREE = window.THREE
  return THREE ? new THREE.Vector4(rgb[0], rgb[1], rgb[2], THEMING_INTENSITY) : null
}

/** Themes every wall and glazing element of each orientation by that orientation's WWR. */
export function colorByOrientation(viewer: APSViewer3D, rows: OrientationRow[]): number {
  const model = viewer.model
  if (!model) return 0
  let painted = 0
  for (const row of rows) {
    if (row.wwr === null) continue
    const color = themingVector(oklchToRgb(wwrStop(row.wwr)))
    if (!color) return painted
    for (const dbId of [...row.wallDbIds, ...row.glazingDbIds]) {
      viewer.setThemingColor(dbId, color, model, true)
      painted++
    }
  }
  viewer.impl.invalidate(true)
  return painted
}

export function clearTheming(viewer: APSViewer3D): void {
  if (viewer.model) viewer.clearThemingColors(viewer.model)
  viewer.impl.invalidate(true)
}

/** Select, isolate and frame the elements. Empty input shows the whole model again. */
export function isolateDbIds(viewer: APSViewer3D, dbIds: readonly number[]): void {
  const ids = [...dbIds]
  if (ids.length === 0) {
    viewer.isolate([])
    viewer.clearSelection()
    viewer.fitToView(null)
    return
  }
  viewer.isolate(ids)
  viewer.select(ids)
  viewer.fitToView(ids)
}

export function selectDbIds(viewer: APSViewer3D, dbIds: readonly number[]): void {
  viewer.isolate([])
  viewer.select([...dbIds])
  viewer.fitToView([...dbIds])
}

/** Turns the lit AEC environment into a flat stage the colour of the page. */
export function applyDarkStage(viewer: APSViewer3D): void {
  const [r, g, b] = STAGE_BACKGROUND
  viewer.setEnvMapBackground(false)
  viewer.setBackgroundColor(r, g, b, r, g, b)
}
