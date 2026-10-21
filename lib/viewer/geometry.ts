import type { Bbox, FacadeGeometry, FacadeKind, Footprint } from '@/lib/edge/types'

/** World-space triangles of one element, nine numbers each (three xyz vertices), in metres. */
export type Triangles = { data: Float64Array; count: number }

const RES = 4
const BINS = 360 * RES
const HALF = BINS / 2
const W = 3 * RES
const hist = new Float64Array(BINS)
/** Opposite bins summed: a wall's two faces land half a turn apart. */
const folded = new Float64Array(HALF)
const candidate = new Uint8Array(HALF)
const touched = new Int32Array(BINS)
let touchedCount = 0
/** Faces whose normal is within this of horizontal count as wall faces. */
const VERTICAL_NZ = 0.2
/** Faces within this of the wall axis count as its main faces, for midplane and thickness. */
const MAIN_FACE_DOT = 0.95

/**
 * The plan axis of a wall-like element: the best opposite pair in an area-weighted histogram of horizontal face
 * normals at 0.25 degrees, refined by a weighted mean over a ±3 degree window. A coarser 1 degree histogram turned
 * exact 90 degree walls into 87 degree walls on 210 King. Null when the element has no near-vertical faces.
 *
 * Only windows that hold a non-empty bin are summed. An empty window sums to 0 and never wins, so the pick is the
 * one a full sweep makes.
 */
export function facadeOf(kind: FacadeKind, tris: Triangles): FacadeGeometry | null {
  const d = tris.data
  for (let i = 0; i < touchedCount; i++) {
    hist[touched[i]] = 0
    folded[touched[i] % HALF] = 0
  }
  touchedCount = 0
  let verticalArea = 0
  for (let t = 0; t < tris.count; t++) {
    const o = t * 9
    const ux = d[o + 3] - d[o], uy = d[o + 4] - d[o + 1], uz = d[o + 5] - d[o + 2]
    const wx = d[o + 6] - d[o], wy = d[o + 7] - d[o + 1], wz = d[o + 8] - d[o + 2]
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-12 || Math.abs(nz / len) >= VERTICAL_NZ) continue
    const bin = ((Math.round(((Math.atan2(ny, nx) * 180) / Math.PI) * RES) % BINS) + BINS) % BINS
    if (hist[bin] === 0) touched[touchedCount++] = bin
    hist[bin] += len / 2
    verticalArea += len / 2
  }
  if (verticalArea === 0) return null

  for (let i = 0; i < touchedCount; i++) {
    const j = touched[i] % HALF
    folded[j] = hist[j] + hist[j + HALF]
    for (let k = -W; k <= W; k++) candidate[(j + k + HALF) % HALF] = 1
  }
  const at = (i: number) => hist[(i + BINS) % BINS]
  let best = -1
  let peak = 0
  for (let b = 0; b < HALF; b++) {
    if (!candidate[b]) continue
    candidate[b] = 0
    let s = 0
    for (let k = -W; k <= W; k++) s += folded[(b + k + HALF) % HALF]
    if (s > best) {
      best = s
      peak = b
    }
  }
  let sw = 0
  let sa = 0
  for (let k = -W; k <= W; k++) {
    const w = at(peak + k) + at(peak + HALF + k)
    sw += w
    sa += w * k
  }
  const axisDeg = ((peak + sa / sw) / RES + 360) % 180
  const th = (axisDeg * Math.PI) / 180
  const n: [number, number] = [Math.cos(th), Math.sin(th)]
  const u: [number, number] = [-n[1], n[0]]

  let sp = 0, ap = 0, sm = 0, am = 0, cu = 0, ca = 0
  let umin = Infinity, umax = -Infinity, zmin = Infinity, zmax = -Infinity
  for (let t = 0; t < tris.count; t++) {
    const o = t * 9
    const ux = d[o + 3] - d[o], uy = d[o + 4] - d[o + 1], uz = d[o + 5] - d[o + 2]
    const wx = d[o + 6] - d[o], wy = d[o + 7] - d[o + 1], wz = d[o + 8] - d[o + 2]
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-12) continue
    const area = len / 2
    const dot = (nx * n[0] + ny * n[1]) / len
    const gx = (d[o] + d[o + 3] + d[o + 6]) / 3
    const gy = (d[o + 1] + d[o + 4] + d[o + 7]) / 3
    const proj = gx * n[0] + gy * n[1]
    if (dot > MAIN_FACE_DOT) {
      sp += proj * area
      ap += area
    } else if (dot < -MAIN_FACE_DOT) {
      sm += proj * area
      am += area
    }
    for (let v = 0; v < 9; v += 3) {
      const q = d[o + v] * u[0] + d[o + v + 1] * u[1]
      if (q < umin) umin = q
      if (q > umax) umax = q
      if (d[o + v + 2] < zmin) zmin = d[o + v + 2]
      if (d[o + v + 2] > zmax) zmax = d[o + v + 2]
    }
    if (Math.abs(dot) > MAIN_FACE_DOT) {
      cu += (gx * u[0] + gy * u[1]) * area
      ca += area
    }
  }
  const sPlus = ap ? sp / ap : 0
  const sMinus = am ? sm / am : 0
  return {
    kind,
    axisDeg,
    n,
    u,
    sMid: ap && am ? (sPlus + sMinus) / 2 : ap ? sPlus : sMinus,
    thickness: ap && am ? Math.max(0, sPlus - sMinus) : 0,
    umin,
    umax,
    zmin,
    zmax,
    uc: ca ? cu / ca : (umin + umax) / 2,
    verticalArea,
  }
}

export function footprintOf(tris: Triangles, baseOffset: number, bottomTolM: number): Footprint | null {
  const d = tris.data
  let zmin = Infinity
  let zmax = -Infinity
  for (let i = 0; i < tris.count * 9; i += 3) {
    zmin = Math.min(zmin, d[i + 2])
    zmax = Math.max(zmax, d[i + 2])
  }
  const triangles: number[] = []
  for (let t = 0; t < tris.count; t++) {
    const o = t * 9
    const cross = (d[o + 3] - d[o]) * (d[o + 7] - d[o + 1]) - (d[o + 4] - d[o + 1]) * (d[o + 6] - d[o])
    if (Math.abs(cross) <= 1e-9) continue
    if (Math.max(d[o + 2], d[o + 5], d[o + 8]) >= zmin + bottomTolM) continue
    triangles.push(d[o], d[o + 1], d[o + 3], d[o + 4], d[o + 6], d[o + 7])
  }
  return triangles.length > 0 ? { triangles, zmin, zmax, baseOffset } : null
}

type FragmentGeometry = {
  vb?: Float32Array
  ib?: Uint16Array | Uint32Array
  vbstride: number
  attributes?: { position?: { offset?: number } }
  isLines?: boolean
  isWideLines?: boolean
  isPoints?: boolean
}

type Matrix4Like = { elements: ArrayLike<number> }
type Box3Like = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }

/** The private parts of a viewer model this module reads. The viewer's typings do not declare them. */
export type ViewerModelGeometry = {
  getInstanceTree(): {
    enumNodeFragments(dbId: number, cb: (fragId: number) => void, recursive?: boolean): void
    getNodeParentId(dbId: number): number
  }
  getFragmentList(): {
    getGeometry(fragId: number): FragmentGeometry | null
    getWorldMatrix(fragId: number, out: Matrix4Like): void
    getWorldBounds(fragId: number, out: Box3Like): void
  }
}

type ThreeGlobal = { Matrix4: new () => Matrix4Like; Box3: new () => Box3Like }

/** Reads fragment triangles and bounds in world space, scaled to metres. One reusable buffer, so each result is valid until the next call. */
export function createGeometryReader(model: ViewerModelGeometry, metresPerUnit: number) {
  const THREE = (globalThis as { THREE?: ThreeGlobal }).THREE
  if (!THREE) throw new Error('createGeometryReader: the viewer runtime (global THREE) is not loaded')
  const tree = model.getInstanceTree()
  const frags = model.getFragmentList()
  const matrix = new THREE.Matrix4()
  const box = new THREE.Box3()
  let buffer = new Float64Array(9 * 1024)
  let triangleCount = 0
  let missingGeometry = 0

  const fragmentsOf = (dbId: number) => {
    const ids: number[] = []
    // A truthy return from the callback stops the enumeration, so the body must not return push's length.
    tree.enumNodeFragments(
      dbId,
      (f) => {
        ids.push(f)
      },
      true,
    )
    return ids
  }

  function triangles(dbId: number): Triangles {
    let count = 0
    for (const f of fragmentsOf(dbId)) {
      const g = frags.getGeometry(f)
      if (!g || !g.vb || !g.ib) {
        missingGeometry++
        continue
      }
      if (g.isLines || g.isWideLines || g.isPoints) continue
      frags.getWorldMatrix(f, matrix)
      const e = matrix.elements
      const { vb, ib, vbstride: stride } = g
      const off = g.attributes?.position?.offset ?? 0
      const need = (count + Math.floor(ib.length / 3)) * 9
      if (need > buffer.length) {
        const grown = new Float64Array(Math.max(need, buffer.length * 2))
        grown.set(buffer.subarray(0, count * 9))
        buffer = grown
      }
      for (let t = 0; t + 2 < ib.length; t += 3) {
        const o = count * 9
        for (let v = 0; v < 3; v++) {
          const k = ib[t + v] * stride + off
          const x = vb[k], y = vb[k + 1], z = vb[k + 2]
          buffer[o + v * 3] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * metresPerUnit
          buffer[o + v * 3 + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * metresPerUnit
          buffer[o + v * 3 + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * metresPerUnit
        }
        count++
      }
    }
    triangleCount += count
    return { data: buffer, count }
  }

  function bbox(dbId: number): Bbox | undefined {
    const ids = fragmentsOf(dbId)
    if (ids.length === 0) return undefined
    const b: Bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    for (const f of ids) {
      frags.getWorldBounds(f, box)
      b[0] = Math.min(b[0], box.min.x)
      b[1] = Math.min(b[1], box.min.y)
      b[2] = Math.min(b[2], box.min.z)
      b[3] = Math.max(b[3], box.max.x)
      b[4] = Math.max(b[4], box.max.y)
      b[5] = Math.max(b[5], box.max.z)
    }
    return b.map((x) => x * metresPerUnit) as Bbox
  }

  return {
    triangles,
    bbox,
    hasFragments: (dbId: number) => fragmentsOf(dbId).length > 0,
    parentOf: (dbId: number) => tree.getNodeParentId(dbId),
    stats: () => ({ triangles: triangleCount, missingGeometry }),
  }
}
