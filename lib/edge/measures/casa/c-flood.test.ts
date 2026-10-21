import { describe, expect, test } from 'vitest'
import { classify, element, facadeAlong, room, snapshotOf } from '../../__fixtures__/synthetic'
import type { Element, MeasureResult, ProjectInputs } from '../../types'
import { C_FLOOD, C_FLOOD_LABELS as L } from './c-flood'

const opening = (category: 'Revit Windows' | 'Revit Doors', typeKey: string, sill: number, params: Element['params'] = {}) => {
  const g = facadeAlong(category === 'Revit Doors' ? 'door' : 'window', [1, 0], [2, 0], sill, sill + 1.2, 0.1)
  return element(category, typeKey, { width: 1, height: 1.2, facade: g.facade, bbox: g.bbox, params })
}

/** Three levels: a lobby and a parking room at 0, a bedroom at 3, a living room at 6; a window and doors at each sill height. */
function threeLevels() {
  const lobby = room('Lobby', 'L0', [0, 0, 10, 10], 0, 3)
  const parking = room('Parqueadero', 'L0', [10, 0, 20, 10], -0.5, 3)
  const bedroom = room('Habitación', 'L1', [0, 0, 10, 10], 3, 6)
  const living = room('Sala', 'L2', [0, 0, 10, 10], 6, 9)
  const lowWindow = opening('Revit Windows', 'Window / W', 0.9)
  const highWindow = opening('Revit Windows', 'Window / W', 3.9)
  const entry = opening('Revit Doors', 'Door / Entry', 0, { Function: 'Exterior' })
  const inner = opening('Revit Doors', 'Door / Inner', 3, { Function: 'Interior' })
  const snapshot = snapshotOf(
    [lobby, parking, bedroom, living, lowWindow, highWindow, entry, inner],
    [
      { name: 'L0', elevation: 0 },
      { name: 'L1', elevation: 3 },
      { name: 'L2', elevation: 6 },
    ],
  )
  const classifications = classify({ 'Window / W': 'window', 'Door / Entry': 'door', 'Door / Inner': 'door', 'Room / Room': 'room' })
  return { snapshot, classifications, lobby, parking, lowWindow, entry }
}

const value = (r: MeasureResult, label: string) => r.inputs.find((i) => i.label === label)
const typed: ProjectInputs = { roadGradeM: 1, floodElevationM: 1.5, floodReturnYears: 50 }

describe('C-FLOOD', () => {
  const t = threeLevels()

  test('lists habitable spaces below road grade and the flood elevation, and openings below the flood elevation', () => {
    const r = C_FLOOD.compute(t.snapshot, t.classifications, [], typed)
    expect(r.state).toBe('ok')
    expect(value(r, L.spaces)?.value).toBe(3)
    expect(value(r, L.lowest)).toMatchObject({ value: 0, dbIds: [t.lobby.dbId] })
    expect(value(r, L.lowestMinusRoad)?.value).toBe(-1)
    expect(value(r, L.belowRoad)).toMatchObject({ value: 1, dbIds: [t.lobby.dbId] })
    expect(value(r, L.atOrBelowFlood)).toMatchObject({ value: 1, dbIds: [t.lobby.dbId] })
    expect(value(r, L.windowsBelowFlood)).toMatchObject({ value: 1, dbIds: [t.lowWindow.dbId] })
    expect(value(r, L.doorsBelowFlood)).toMatchObject({ value: 1, dbIds: [t.entry.dbId] })
    expect(value(r, L.entry)).toMatchObject({ value: 0, dbIds: [t.entry.dbId] })
    expect(value(r, L.entryMinusFlood)?.value).toBe(-1.5)
    expect(r.inputs.flatMap((i) => i.dbIds ?? [])).not.toContain(t.parking.dbId)
  })

  test('typed elevations are in the survey datum; the datum offset moves the model up to meet them', () => {
    const r = C_FLOOD.compute(t.snapshot, t.classifications, [], { ...typed, datumOffsetM: 2 })
    expect(value(r, L.lowest)?.value).toBe(2)
    expect(value(r, L.belowRoad)?.value).toBe(0)
    expect(value(r, L.atOrBelowFlood)?.value).toBe(0)
    expect(value(r, L.windowsBelowFlood)?.value).toBe(0)
    expect(value(r, L.entryMinusFlood)?.value).toBe(0.5)
  })

  test('without the typed elevations it is blocked, names each missing input, and still reports the lowest habitable floor', () => {
    const r = C_FLOOD.compute(t.snapshot, t.classifications, [], {})
    expect(r.state).toBe('blocked')
    expect(r.blockedBy).toEqual([
      { kind: 'missing-input', input: 'roadGradeM' },
      { kind: 'missing-input', input: 'floodElevationM' },
      { kind: 'missing-input', input: 'floodReturnYears' },
    ])
    expect(value(r, L.lowest)?.value).toBe(0)
    expect(value(r, L.belowRoad)).toBeUndefined()
    const partial = C_FLOOD.compute(t.snapshot, t.classifications, [], { roadGradeM: 1 })
    expect(partial.blockedBy?.map((b) => (b.kind === 'missing-input' ? b.input : b.kind))).toEqual(['floodElevationM', 'floodReturnYears'])
    expect(value(partial, L.belowRoad)?.value).toBe(1)
  })

  test('in a floodplain, a 50-year elevation is flagged against the 100-year rule', () => {
    const r = C_FLOOD.compute(t.snapshot, t.classifications, [], { ...typed, inFloodplain: true })
    expect(r.flags?.map((f) => [f.threshold, f.guide.page])).toEqual([[100, '76']])
    expect(C_FLOOD.compute(t.snapshot, t.classifications, [], { ...typed, floodReturnYears: 100, inFloodplain: true }).flags).toEqual([])
  })

  test('with no placed rooms, the levels carrying dwelling units stand in for habitable floors', () => {
    const levels = [
      { name: 'Nivel C', elevation: 0 },
      { name: 'Nivel 1', elevation: 10.49 },
      { name: 'Nivel 2', elevation: 13.54 },
    ]
    const tagged = ['Nivel 1', 'Nivel 2'].map((level) => element('Revit Floors', 'Floor / Acabados Porcelanato Al.', { level, area: 20, params: { Comments: 'Tipo 1' } }))
    const r = C_FLOOD.compute(snapshotOf(tagged, levels), [], [], typed)
    expect(value(r, L.spaces)).toMatchObject({ value: 2, source: 'levels' })
    expect(value(r, L.lowest)).toMatchObject({ value: 10.49, dbIds: [tagged[0].dbId] })
    expect(value(r, L.belowRoad)?.value).toBe(0)
  })

  test('an unclassified window type keeps the result provisional', () => {
    const cls = t.classifications.filter((c) => c.typeKey !== 'Window / W')
    const r = C_FLOOD.compute(t.snapshot, cls, [], typed)
    expect(r.state).toBe('provisional')
    expect(r.pendingTypeKeys).toEqual(['Window / W'])
  })
})
