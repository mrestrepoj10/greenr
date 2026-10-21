import { describe, expect, test } from 'vitest'
import { box, classify, element, facadeAlong, room, snapshotOf } from '../__fixtures__/synthetic'
import { computeRun, DEFAULT_SCOPE } from '../run'
import { edgeRound } from '../storeys'
import { MEASURE_CODES, schemeOf, type Classification, type Element, type MeasureCode, type RunResult } from '../types'
import { MEASURES } from '.'

const measure = (run: RunResult, code: MeasureCode) => run.measures.find((m) => m.code === code)!
const input = (run: RunResult, code: MeasureCode, label: string) =>
  measure(run, code).inputs.find((i) => i.label.startsWith(label))!.value

describe('EEM01 arithmetic', () => {
  const { snapshot, classifications } = box()
  const eem01 = MEASURES.EEM01.compute(snapshot, classifications, [], {})
  const row = (o: string) => eem01.orientations!.find((r) => r.orientation === o)!

  test('gross façade is net wall area plus window and door W x H; glazing is windows plus glazed panels', () => {
    expect(row('S').wallAreaM2).toBeCloseTo(137 + 3, 9)
    expect(row('S').glazingAreaM2).toBeCloseTo(3, 9)
    expect(row('N').wallAreaM2).toBeCloseTo(136 + 4, 9)
    expect(row('N').glazingAreaM2).toBeCloseTo(4, 9)
    expect(row('E').wallAreaM2).toBeCloseTo(68 + 2, 9)
    expect(row('E').glazingAreaM2).toBe(0)
    expect(row('W').wallAreaM2).toBeCloseTo(70, 9)
    expect(row('W').glazingAreaM2).toBeCloseTo(40, 9)
    expect(row('W').wwr).toBeCloseTo(40 / 70, 9)
    expect(row('NE').wwr).toBeNull()
  })

  test('overall WWR is total glazing over total gross façade', () => {
    expect(eem01.inputs[0].value).toBeCloseTo(47 / 420, 9)
  })

  test('a skylight-classified window leaves façade glazing', () => {
    const cls = classifications.map((c) => (c.typeKey === 'Window / W2' ? { ...c, role: 'skylight' as const } : c))
    const r = MEASURES.EEM01.compute(snapshot, cls, [], {}).orientations!.find((o) => o.orientation === 'N')!
    expect(r.glazingAreaM2).toBe(0)
    expect(r.wallAreaM2).toBeCloseTo(136, 9)
  })

  test('a window set in a curtain wall adds glazing but no gross area, since the curtain wall area already covers it', () => {
    const { snapshot: s, classifications: c, ids } = box()
    const g = facadeAlong('window', [0, 7], [0, 8.5], 4, 5.5, 0.05)
    const cwWindow = element('Revit Windows', 'CW_SYS_PNL_WINDOW / CW', { width: 1.5, height: 1.5, facade: g.facade, bbox: g.bbox, hostDbId: ids.west.dbId })
    const withWindow = { ...s, elements: [...s.elements, cwWindow] }
    const west = MEASURES.EEM01.compute(withWindow, [...c, ...classify({ 'CW_SYS_PNL_WINDOW / CW': 'window' })], [], {}).orientations!.find((o) => o.orientation === 'W')!
    expect(west.wallAreaM2).toBeCloseTo(70, 9)
    expect(west.glazingAreaM2).toBeCloseTo(40 + 2.25, 9)
    expect(west.glazingDbIds).toContain(cwWindow.dbId)
  })

  test('a confirmed user exclusion drops the wall and the windows it hosts', () => {
    const { snapshot: s, classifications: c, ids } = box()
    const r = MEASURES.EEM01.compute(
      s,
      c,
      [{ id: 'u1', dbIds: [ids.south.dbId], reason: 'user', source: 'user', status: 'accepted' }],
      {},
    )
    expect(r.orientations!.find((o) => o.orientation === 'S')!.wallAreaM2).toBe(0)
  })

  test('model-sourced or unclassified façade types make the measure provisional and are listed', () => {
    const cls: Classification[] = classifications
      .filter((c) => c.typeKey !== 'Door / D1')
      .map((c) => (c.typeKey === 'Window / W1' ? { ...c, source: 'model', confidence: 0.9 } : c))
    const r = MEASURES.EEM01.compute(snapshot, cls, [], {})
    expect(r.state).toBe('provisional')
    expect(r.pendingTypeKeys).toEqual(['Door / D1', 'Window / W1'])
    expect(MEASURES.EEM01.compute(snapshot, classifications, [], {}).state).toBe('ok')
  })
})

function tower() {
  const slab = (top: number, typeKey = 'Floor / Slab') =>
    element('Revit Floors', typeKey, { area: 100, bbox: [0, 0, top - 0.3, 10, 10, top] })
  return { slab, rooms: (zs: number[]) => zs.map((z, i) => room(`R${i}`, `L${i}`, [0, 0, 10, 10], z, z + 2.7)) }
}

describe('D-FLOORS', () => {
  test('a storey is below grade when more than half its height is below ground', () => {
    const { slab, rooms } = tower()
    const deep = rooms([-3, 0, 3])
    const levels = [
      { name: 'L0', elevation: -3 },
      { name: 'L1', elevation: 0 },
      { name: 'L2', elevation: 3 },
    ]
    const s = snapshotOf([...deep, slab(0), slab(3), slab(6)], levels)
    const run = computeRun(s, classify({ 'Floor / Slab': 'floor' }), [], DEFAULT_SCOPE, undefined, 'now')
    expect(input(run, 'D-FLOORS', 'Floors above grade')).toBe(2)
    expect(input(run, 'D-FLOORS', 'Floors below grade')).toBe(1)
    expect(input(run, 'D-F2F', 'Floor-to-floor')).toBeCloseTo(3, 9)
  })

  test('a storey sunk less than half its height counts above grade', () => {
    const { slab, rooms } = tower()
    const shallow = rooms([-1, 2, 5])
    const levels = [
      { name: 'L0', elevation: -1 },
      { name: 'L1', elevation: 2 },
      { name: 'L2', elevation: 5 },
    ]
    const s = snapshotOf([...shallow, slab(2), slab(5), slab(8)], levels)
    const run = computeRun(s, classify({ 'Floor / Slab': 'floor' }), [], DEFAULT_SCOPE, undefined, 'now')
    expect(input(run, 'D-FLOORS', 'Floors above grade')).toBe(3)
    expect(input(run, 'D-FLOORS', 'Floors below grade')).toBe(0)
  })

  test('EDGE rounds the weighted floor count half up', () => {
    expect([1.4, 1.5, 5.69, 0.49].map(edgeRound)).toEqual([1, 2, 6, 0])
  })
})

describe('AU-SKYLIGHT', () => {
  const roofAndSkylights = (skylightM2: number) => {
    const roof = element('Revit Roofs', 'Basic Roof / R', { area: 200, bbox: [0, 0, 6, 20, 10, 6.3] })
    const sky = element('Revit Windows', 'Skylight / S', { width: 1, height: skylightM2 })
    return snapshotOf([roof, sky], [])
  }
  const cls = classify({ 'Basic Roof / R': 'roof', 'Skylight / S': 'skylight' })
  const flagsAt = (m2: number) => MEASURES['AU-SKYLIGHT'].compute(roofAndSkylights(m2), cls, [], {}).flags!.map((f) => f.level)

  test('reports the skylight share of roof area', () => {
    const r = MEASURES['AU-SKYLIGHT'].compute(roofAndSkylights(3), cls, [], {})
    expect(r.inputs.find((i) => i.label === 'Skylight share of roof area')!.value).toBeCloseTo(0.015, 9)
  })

  test('flags at 1% (Part 3) and adds the mandatory note above 5% (Part 8)', () => {
    expect(flagsAt(1.99)).toEqual([])
    expect(flagsAt(2)).toEqual(['flag'])
    expect(flagsAt(10)).toEqual(['flag'])
    expect(flagsAt(10.01)).toEqual(['flag', 'mandatory'])
  })
})

describe('EEM09 and EEM02 gaps', () => {
  test('zero U, SHGC or VT counts as missing; thermal resistance stands in for U', () => {
    const zeros: Element['params'] = {
      'Heat Transfer Coefficient (U)': 0,
      'Solar Heat Gain Coefficient': 0.4,
      'Visual Light Transmittance': 0,
      'Analytic Construction': '1/8 in Pilkington single glazing',
    }
    const { snapshot, classifications } = box({ windowParams: zeros })
    const gaps = MEASURES.EEM09.compute(snapshot, classifications, [], {}).gaps
    const w1 = gaps.find((g) => g.typeKey === 'Window / W1')!
    expect(w1.missing).toBe('Heat Transfer Coefficient (U), Visual Light Transmittance')
    expect(w1.severity).toBe('needs-data-sheet')
    expect(gaps.find((g) => g.typeKey === 'System Panel / Glazed')!.missing).toBe(
      'Heat Transfer Coefficient (U), Solar Heat Gain Coefficient, Visual Light Transmittance',
    )

    const complete = { 'Thermal Resistance (R)': 0.55, 'Solar Heat Gain Coefficient': 0.35, 'Visual Light Transmittance': 0.6 }
    const ok = box({ windowParams: complete })
    expect(MEASURES.EEM09.compute(ok.snapshot, ok.classifications, [], {}).gaps.map((g) => g.typeKey)).toEqual([
      'System Panel / Glazed',
    ])
  })

  test('a roof type with no SRI blocks the EEM02 claim', () => {
    const plain = element('Revit Roofs', 'Basic Roof / Plain', { area: 100, bbox: [0, 0, 6, 10, 10, 6.3] })
    const white = element('Revit Roofs', 'Basic Roof / Cool', {
      area: 100,
      bbox: [10, 0, 6, 20, 10, 6.3],
      params: { 'Solar Reflectance Index': 82 },
    })
    const r = MEASURES.EEM02.compute(
      snapshotOf([plain, white], []),
      classify({ 'Basic Roof / Plain': 'roof', 'Basic Roof / Cool': 'roof' }),
      [],
      {},
    )
    expect(r.state).toBe('blocked')
    expect(r.gaps.map((g) => [g.typeKey, g.severity])).toEqual([['Basic Roof / Plain', 'blocks-claim']])
  })
})

describe('computeRun', () => {
  test('a run waits on unconfirmed exclusions and settles once they are confirmed', () => {
    const { snapshot, classifications } = box({ wallTop: 9 })
    const proposals = [{ id: 'rule:parapet', dbIds: [1, 2, 3], reason: 'parapet' as const, source: 'rule' as const, status: 'proposed' as const }]
    const first = computeRun(snapshot, classifications, proposals, DEFAULT_SCOPE, undefined, 't0')
    expect(first.state).toBe('provisional')
    expect(measure(first, 'EEM01').pendingExclusionIds).toEqual(['rule:parapet'])
    const second = computeRun(snapshot, classifications, [{ ...proposals[0], status: 'accepted' as const }], DEFAULT_SCOPE, first, 't1')
    expect(second.state).toBe('confirmed')
    expect(second.runId).toBe(first.runId)
    expect(measure(second, 'EEM01').inputs[1].value as number).toBeLessThan(measure(first, 'EEM01').inputs[1].value as number)
  })

  test('an EDGE run lists every EDGE code once, in registry order', () => {
    const { snapshot, classifications } = box()
    const run = computeRun(snapshot, classifications, [], DEFAULT_SCOPE, undefined, 't0')
    expect(run.measures.map((m) => m.code)).toEqual(['D-GIA', 'D-FLOORS', 'D-F2F', 'D-ROOF', 'EEM01', 'EEM02', 'EEM09', 'AU-SKYLIGHT'])
    expect(input(run, 'D-GIA', 'Gross internal area')).toBeCloseTo(4 * 9.7 * 9.7, 9)
  })
})


describe('schemes', () => {
  const { snapshot, classifications } = box()
  const both = computeRun(snapshot, classifications, [], { schemes: ['CASA', 'EDGE'], inputs: { climateZone: 'templado' } }, undefined, 't0')

  test('a run measures only the selected schemes, EDGE before CASA whatever the selection order', () => {
    expect(both.measures.map((m) => m.code)).toEqual([...MEASURE_CODES.EDGE, ...MEASURE_CODES.CASA])
    const casa = computeRun(snapshot, classifications, [], { schemes: ['CASA'], inputs: {} }, undefined, 't0')
    expect(casa.measures.map((m) => m.code)).toEqual([...MEASURE_CODES.CASA])
  })

  test('the run records its schemes in scheme order, the inputs it read and the guide version per scheme', () => {
    expect(both.schemes).toEqual(['EDGE', 'CASA'])
    expect(both.inputs).toEqual({ climateZone: 'templado' })
    expect(both.guides).toEqual({ EDGE: 'V3.1', CASA: '3.1 (Edición 2026)' })
  })

  test('adding CASA leaves every EDGE result as it was', () => {
    const edge = computeRun(snapshot, classifications, [], DEFAULT_SCOPE, undefined, 't0')
    expect(both.measures.slice(0, MEASURE_CODES.EDGE.length)).toEqual(edge.measures)
  })

  test('a CASA measure without its computation is blocked and says so instead of reporting a value', () => {
    const pending = new Set<MeasureCode>(['C-SRI'])
    for (const m of both.measures.filter((x) => pending.has(x.code))) {
      expect(m.state).toBe('blocked')
      expect(m.blockedBy).toEqual([{ kind: 'not-implemented' }])
      expect(m.inputs).toEqual([])
    }
  })

  test('every registry entry sits under its own code and scheme, with credits and a guide page', () => {
    for (const [code, m] of Object.entries(MEASURES)) {
      expect(m.code).toBe(code)
      expect(m.scheme).toBe(schemeOf(m.code))
      expect(m.credits.length).toBeGreaterThan(0)
      expect(m.guide.url).toMatch(/^https:\/\/.+#page=\d+$/)
    }
  })

  test('CASA links open the PDF one page after the printed page, past the cover', () => {
    const bec3 = MEASURES['C-SRI'].guide
    expect(bec3).toMatchObject({ doc: 'CASA Colombia', version: '3.1 (Edición 2026)', page: '94' })
    expect(bec3.url).toBe('https://casa.cccs.org.co/wp-content/uploads/2026/08/2026_CASA-Colombia-V3.pdf#page=95')
    expect(MEASURES['C-ENV'].credits).toEqual(['GGc5', 'SBp3', 'Ep1', 'MS&C §2'])
  })
})
