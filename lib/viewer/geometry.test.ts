import { describe, expect, test } from 'vitest'
import { facadeOf, footprintOf, type Triangles } from './geometry'

type P = [number, number, number]

/** The 12 triangles of a box with plan corners a, b, c, d (counter-clockwise) from z0 to z1, outward-facing. */
function prism(corners: [number, number][], z0: number, z1: number): Triangles {
  const tris: number[] = []
  const quad = (p: P, q: P, r: P, s: P) => tris.push(...p, ...q, ...r, ...p, ...r, ...s)
  const n = corners.length
  for (let i = 0; i < n; i++) {
    const [ax, ay] = corners[i]
    const [bx, by] = corners[(i + 1) % n]
    quad([ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1])
  }
  const [a, b, c, d] = corners
  quad([a[0], a[1], z0], [d[0], d[1], z0], [c[0], c[1], z0], [b[0], b[1], z0])
  quad([a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1], [d[0], d[1], z1])
  return { data: Float64Array.from(tris), count: tris.length / 9 }
}

/** A straight wall slab of the given length, thickness and height, centred on (cx, cy) and turned by `deg`. */
function wall(cx: number, cy: number, length: number, thickness: number, deg: number, z0: number, z1: number): Triangles {
  const t = (deg * Math.PI) / 180
  const d = [Math.cos(t), Math.sin(t)]
  const n = [-d[1], d[0]]
  const at = (s: number, o: number): [number, number] => [cx + d[0] * s + n[0] * o, cy + d[1] * s + n[1] * o]
  return prism([at(-length / 2, -thickness / 2), at(length / 2, -thickness / 2), at(length / 2, thickness / 2), at(-length / 2, thickness / 2)], z0, z1)
}

describe('facadeOf', () => {
  test('a wall along x has its normal on y, its thickness, length and height', () => {
    const g = facadeOf('wall', wall(5, 2, 10, 0.3, 0, 0, 3))!
    expect(g.axisDeg).toBeCloseTo(90, 6)
    expect(Math.abs(g.sMid)).toBeCloseTo(2, 6)
    expect(g.thickness).toBeCloseTo(0.3, 6)
    expect(g.umax - g.umin).toBeCloseTo(10, 6)
    expect([g.zmin, g.zmax]).toEqual([0, 3])
    expect(g.verticalArea).toBeCloseTo(2 * 10 * 3 + 2 * 0.3 * 3, 6)
  })

  test('a wall turned 30 degrees reads its axis to within a hundredth of a degree', () => {
    const g = facadeOf('wall', wall(0, 0, 12, 0.25, 30, 0, 4))!
    expect(g.axisDeg).toBeCloseTo(120, 2)
    expect(g.thickness).toBeCloseTo(0.25, 6)
    expect(g.umax - g.umin).toBeCloseTo(12, 6)
  })

  test('an element with no near-vertical faces has no façade record', () => {
    const flat: Triangles = { data: Float64Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]), count: 1 }
    expect(facadeOf('window', flat)).toBeNull()
  })
})

describe('footprintOf', () => {
  test('keeps only the floor triangles of a room volume, in plan', () => {
    const room = prism(
      [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
      ],
      10,
      12.7,
    )
    const fp = footprintOf(room, 0.5, 0.01524)!
    expect(fp.zmin).toBe(10)
    expect(fp.zmax).toBe(12.7)
    expect(fp.baseOffset).toBe(0.5)
    expect(fp.triangles).toHaveLength(12)
    let area = 0
    for (let i = 0; i < fp.triangles.length; i += 6) {
      const [x0, y0, x1, y1, x2, y2] = fp.triangles.slice(i, i + 6)
      area += Math.abs((x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)) / 2
    }
    expect(area).toBeCloseTo(12, 9)
  })
})
