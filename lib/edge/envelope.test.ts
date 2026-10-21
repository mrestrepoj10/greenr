import { describe, expect, test } from 'vitest'
import { box, classify, element, facadeAlong } from './__fixtures__/synthetic'
import { analyzeEnvelope, finishLayers } from './envelope'
import { proposeExclusions } from './exclusions'
import { tallyFacade } from './measures/eem01'
import type { Element } from './types'

const rowOf = (rows: ReturnType<typeof tallyFacade>['rows'], o: string) => rows.find((r) => r.orientation === o)!

describe('envelope probe on a two-storey box', () => {
  test('each outer wall lands in its own orientation and the partition stays out', () => {
    const { snapshot, classifications, ids } = box()
    const { rows, walls } = tallyFacade(snapshot, classifications, [])
    expect(rowOf(rows, 'S').wallDbIds).toEqual([ids.south.dbId])
    expect(rowOf(rows, 'N').wallDbIds).toEqual([ids.north.dbId])
    expect(rowOf(rows, 'E').wallDbIds.sort()).toEqual([ids.east.dbId, ids.eastDoor.dbId].sort())
    expect(rowOf(rows, 'W').wallDbIds).toEqual([ids.west.dbId])
    for (const o of ['NE', 'SE', 'SW', 'NW']) expect(rowOf(rows, o).wallAreaM2).toBe(0)
    const partition = walls.find((w) => w.dbId === ids.partition.dbId)!
    expect(partition.wallClass).toBe('interior')
    expect(partition.counted).toBe(false)
  })

  test('a true north angle moves the bins', () => {
    const { snapshot, classifications, ids } = box({ northAngleDeg: 90 })
    const { rows } = tallyFacade(snapshot, classifications, [])
    expect(rowOf(rows, 'E').wallDbIds).toContain(ids.south.dbId)
    expect(rowOf(rows, 'N').wallDbIds).toContain(ids.east.dbId)
  })

  test('wall above the top room is parapet, and confirming the parapet exclusion clips it', () => {
    const { snapshot, classifications, ids } = box({ wallTop: 9 })
    const probe = analyzeEnvelope(snapshot).walls.get(ids.south.dbId)!
    expect(probe.wallClass).toBe('envelope')
    expect(probe.tally.parapet).toBeGreaterThan(0)

    const proposals = proposeExclusions(snapshot, classifications)
    const parapet = proposals.find((p) => p.reason === 'parapet')!
    expect(parapet.dbIds).toContain(ids.south.dbId)
    expect(parapet.dbIds).not.toContain(ids.partition.dbId)

    const full = rowOf(tallyFacade(snapshot, classifications, proposals).rows, 'S').opaqueWallAreaM2!
    const clipped = rowOf(tallyFacade(snapshot, classifications, [{ ...parapet, status: 'accepted' }]).rows, 'S').opaqueWallAreaM2!
    expect(full).toBeCloseTo(20 * 9 - 3, 6)
    expect(clipped / full).toBeGreaterThan(0.7)
    expect(clipped / full).toBeLessThan(0.85)
  })

  test('windows find their host wall and face out of the room behind them', () => {
    const { snapshot, ids } = box()
    const env = analyzeEnvelope(snapshot)
    const window = env.openings.get(ids.southWindow.dbId)!
    expect(window.hostDbId).toBe(ids.south.dbId)
    expect(window.azimuthDeg).toBeCloseTo(180, 6)
    expect(env.openings.get(ids.glazedPanel.dbId)!.azimuthDeg).toBeCloseTo(270, 6)
  })
})

describe('finish layers', () => {
  const skin = (typeKey: string, a: [number, number], b: [number, number], thickness: number, top = 7) => {
    const g = facadeAlong('wall', a, b, 0, top, thickness)
    return element('Revit Walls', typeKey, { area: Math.hypot(b[0] - a[0], b[1] - a[1]) * top, facade: g.facade, bbox: g.bbox, params: { Function: 'Exterior' } })
  }
  const withSkins = (...skins: ((ids: ReturnType<typeof box>['ids']) => Element)[]) => {
    const { snapshot, classifications, ids } = box()
    const extra = skins.map((make) => make(ids))
    return { snapshot: { ...snapshot, elements: [...snapshot.elements, ...extra] }, classifications: [...classifications, ...classify({ 'Basic Wall / Revoque Exterior': 'exterior-wall', 'Basic Wall / Pintura': 'exterior-wall' })], ids, extra }
  }

  test('render and paint on the south wall map to it and leave the gross façade unchanged', () => {
    const { snapshot, classifications, ids, extra } = withSkins(
      () => skin('Basic Wall / Revoque Exterior', [0, -0.16], [20, -0.16], 0.02),
      () => skin('Basic Wall / Pintura', [0, -0.171], [20, -0.171], 0.002),
    )
    const env = analyzeEnvelope(snapshot)
    expect([...env.finishLayers]).toEqual(extra.map((s) => [s.dbId, ids.south.dbId]))
    for (const s of extra) expect(env.walls.has(s.dbId)).toBe(false)
    const south = rowOf(tallyFacade(snapshot, classifications, []).rows, 'S')
    expect(south.wallDbIds).toEqual([ids.south.dbId])
    expect(south.wallAreaM2).toBeCloseTo(rowOf(tallyFacade(box().snapshot, box().classifications, []).rows, 'S').wallAreaM2, 9)
  })

  test('a thin wall standing off the face, or one at the thickness threshold, is not a finish layer', () => {
    const { snapshot, extra } = withSkins(
      () => skin('Basic Wall / Revoque Exterior', [0, -0.2], [20, -0.2], 0.02),
      () => skin('Basic Wall / Revoque Exterior', [0, 10.175], [20, 10.175], 0.05),
    )
    expect(finishLayers(snapshot.elements).size).toBe(0)
    for (const s of extra) expect(analyzeEnvelope(snapshot).walls.has(s.dbId)).toBe(true)
  })

  test('a window cut in a skin that runs past the wall behind it is hosted by that wall', () => {
    const { snapshot, ids } = withSkins(() => skin('Basic Wall / Revoque Exterior', [20.16, -4], [20.16, 10], 0.02))
    const g = facadeAlong('window', [20.16, -3], [20.16, -1], 1, 2.5, 0.02)
    const window = element('Revit Windows', 'Window / W3', { width: 2, height: 1.5, facade: g.facade, bbox: g.bbox })
    const env = analyzeEnvelope({ ...snapshot, elements: [...snapshot.elements, window] })
    expect(env.openings.get(window.dbId)!.hostDbId).toBe(ids.east.dbId)
  })
})
