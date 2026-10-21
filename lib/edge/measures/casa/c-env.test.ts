import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { box, classify, element, snapshotOf } from '../../__fixtures__/synthetic'
import { proposeExclusions } from '../../exclusions'
import type { Classification, MeasureResult, Snapshot } from '../../types'
import { MEASURES } from '..'
import { C_ENV, C_ENV_LABELS as L } from './c-env'
import { C_GLAZE, C_GLAZE_LABELS as G } from './c-glaze'

const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../__fixtures__/${name}`, import.meta.url), 'utf8')) as T
const value = (r: MeasureResult, label: string) => r.inputs.find((i) => i.label === label)?.value

describe('C-ENV on 210 King', () => {
  const snapshot = load<Snapshot>('210king.json')
  const classifications = load<Classification[]>('210king.classifications.json')
  const proposals = proposeExclusions(snapshot, classifications)
  const accepted = proposals.map((e) => ({ ...e, status: 'accepted' as const }))
  const env = C_ENV.compute(snapshot, classifications, accepted, {})
  const eem01 = MEASURES.EEM01.compute(snapshot, classifications, accepted, {})

  test('reports four cardinal rows whose gross façade is the EEM01 gross façade', () => {
    expect(env.state).toBe('ok')
    expect(env.orientations!.map((o) => o.orientation)).toEqual(['N', 'E', 'S', 'W'])
    const gross = env.orientations!.reduce((s, o) => s + o.wallAreaM2, 0)
    expect(value(env, L.gross)).toBeCloseTo(gross, 6)
    expect(Math.abs(gross - (eem01.inputs[1].value as number))).toBeLessThan(0.1)
  })

  test('roof area, storeys and floor-to-floor match the EDGE design inputs', () => {
    const edge = (code: 'D-ROOF' | 'D-FLOORS' | 'D-F2F', label: string) => MEASURES[code].compute(snapshot, classifications, accepted, {}).inputs.find((i) => i.label.startsWith(label))!.value
    expect(value(env, L.roof)).toBe(edge('D-ROOF', 'Aggregate roof area'))
    expect(value(env, L.floorsAbove)).toBe(edge('D-FLOORS', 'Floors above grade'))
    expect(value(env, L.f2fAverage)).toBe(edge('D-F2F', 'Floor-to-floor'))
    expect(value(env, L.f2fMin) as number).toBeLessThanOrEqual(value(env, L.f2fAverage) as number)
  })

  test('an unconfirmed exclusion over the façade keeps it provisional', () => {
    const pending = C_ENV.compute(snapshot, classifications, proposals, {})
    expect(pending.state).toBe('provisional')
    expect(pending.pendingExclusionIds?.length).toBeGreaterThan(0)
  })
})

describe('C-ENV with unplaced rooms', () => {
  const { snapshot, classifications } = box()
  const roof = element('Revit Roofs', 'Basic Roof / R', { area: 200, bbox: [0, 0, 7, 20, 10, 7.4] })
  const unplaced: Snapshot = {
    ...snapshot,
    elements: [...snapshot.elements.map((e) => (e.footprint ? { ...e, footprint: undefined, area: 0 } : e)), roof],
  }
  const r = C_ENV.compute(unplaced, [...classifications, ...classify({ 'Basic Roof / R': 'roof' })], [], {})

  test('blocks on placed rooms and withholds the façade, footprint and floor counts', () => {
    expect(r.state).toBe('blocked')
    expect(r.gaps.map((g) => [g.missing, g.severity])).toEqual([['Placed rooms', 'blocks-claim']])
    expect(r.orientations).toBeUndefined()
    for (const label of [L.gross, L.wwr, L.footprint, L.floorsAbove]) expect(value(r, label)).toBeUndefined()
  })

  test('still reports roof, levels, height and glazing types', () => {
    expect(value(r, L.roof)).toBe(200)
    expect(value(r, L.levels)).toBe(2)
    expect(value(r, L.height)).toBeCloseTo(7.4, 9)
    expect(r.inputs.filter((i) => i.label.startsWith('Glazing type: ')).map((i) => i.label)).toEqual([
      'Glazing type: System Panel / Glazed',
      'Glazing type: Window / W2',
      'Glazing type: Window / W1',
    ])
  })

  test('takes floor-to-floor from the levels that carry dwelling units', () => {
    const levels = [
      { name: 'Nivel C', elevation: 0 },
      { name: 'Nivel 1', elevation: 10.49 },
      { name: 'Nivel 2', elevation: 13.54 },
      { name: 'Nivel 2/2', elevation: 15 },
      { name: 'Nivel 3', elevation: 16.59 },
    ]
    const floors = ['Nivel 1', 'Nivel 2', 'Nivel 3'].map((level) => element('Revit Floors', 'Floor / Mortero', { level, area: 60, params: { Comments: 'Tipo 1' } }))
    const t = C_ENV.compute(snapshotOf(floors, levels), [], [], {})
    expect(t.inputs.find((i) => i.label === L.f2fMin)).toMatchObject({ source: 'levels' })
    expect(value(t, L.f2fMin)).toBeCloseTo(3.05, 9)
    expect(value(t, L.f2fAverage)).toBeCloseTo(3.05, 9)
  })
})

describe('C-GLAZE', () => {
  const win = (typeKey: string, params: Record<string, number>) => element('Revit Windows', typeKey, { width: 1, height: 1.5, params })
  const a = win('Ventana / A', { 'Thermal Transmittance (U)': 2.5, 'Solar Heat Gain Coefficient': 0.4, 'Visual Light Transmittance': 0.35 })
  const b = win('Ventana / B', { 'Heat Transfer Coefficient (U)': 3.1, 'Solar Heat Gain Coefficient': 0.5, 'Visual Light Transmittance': 0.6 })
  const c = win('Ventana / C', { 'Thermal Transmittance (U)': 0, 'Heat Transfer Coefficient (U)': 0, 'Solar Heat Gain Coefficient': 0.3, 'Visual Light Transmittance': 0 })
  const slider = element('Revit Doors', 'Puerta corrediza con dos hojas / 2.0 x 2.2', { width: 2, height: 2.2, params: { 'Visual Light Transmittance': 0.8 } })
  const solid = element('Revit Doors', 'Puerta madera / 0.9 x 2.1', { width: 0.9, height: 2.1 })
  const cls = classify({ 'Ventana / A': 'window', 'Ventana / B': 'window', 'Ventana / C': 'window', 'Puerta corrediza con dos hojas / 2.0 x 2.2': 'door', 'Puerta madera / 0.9 x 2.1': 'door' })
  const r = C_GLAZE.compute(snapshotOf([a, b, c, slider, solid], []), cls, [], {})

  test('reads U under either name and treats zero as missing', () => {
    expect(r.gaps.map((g) => [g.typeKey, g.missing])).toEqual([
      ['Puerta corrediza con dos hojas / 2.0 x 2.2', 'Thermal Transmittance (U), Solar Heat Gain Coefficient'],
      ['Ventana / C', 'Thermal Transmittance (U), Visual Light Transmittance'],
    ])
    expect(r.gaps.every((g) => g.severity === 'needs-data-sheet')).toBe(true)
    expect(value(r, G.complete)).toBe(2)
  })

  test('counts glazed sliding doors as glazing and leaves solid doors out', () => {
    expect(value(r, G.types)).toBe(4)
    expect(r.inputs[0].dbIds).toContain(slider.dbId)
    expect(r.inputs[0].dbIds).not.toContain(solid.dbId)
  })

  test('flags a VT at or below 0.40 against SBc6', () => {
    expect(value(r, G.lowVt)).toBe(1)
    expect(r.flags?.map((f) => [f.threshold, f.guide.page, f.message.startsWith('Ventana / A (VT 0.35)')])).toEqual([[0.4, '204', true]])
  })
})
