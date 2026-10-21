import { describe, expect, test } from 'vitest'
import { box } from './__fixtures__/synthetic'
import { analyzeEnvelope } from './envelope'
import { proposeExclusions } from './exclusions'
import { tallyFacade } from './measures/eem01'

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
