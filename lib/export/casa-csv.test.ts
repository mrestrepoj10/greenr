import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { proposeExclusions } from '@/lib/edge/exclusions'
import { computeRun } from '@/lib/edge/run'
import type { Classification, Snapshot } from '@/lib/edge/types'
import { inputsCsv, mscRows } from './csv'
import { fixtureBothRun } from './fixture'

const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../edge/__fixtures__/${name}`, import.meta.url), 'utf8')) as T
const byLabel = (rows: string[][], label: string) => rows.find((r) => r[1] === label)!

describe('casa-inputs.csv MS&C block', () => {
  test('lists the fields in MS&C form order, the window-to-wall ratio as north, south, east, west', () => {
    expect(mscRows(fixtureBothRun).map((r) => r[0])).toEqual([
      '3', '6', '13', '14', '15', '16', '19', '21', '24', '25', '25', '25', '25', '26', '28', '29',
      '3.1.1 c', '3.1.1 c', '3.1.1 d', '3.2 a', '3.2 b', '3.2 b', '3.2 c', '3.2 d',
    ])
    expect(mscRows(fixtureBothRun).filter((r) => r[0] === '25').map((r) => r[1].split(' ').at(-1))).toEqual(['Norte', 'Sur', 'Oriente', 'Occidente'])
  })

  test('typed inputs use the form wording; a blocked measure writes explicit zeros that say so', () => {
    const rows = mscRows(fixtureBothRun)
    expect(rows[0]).toEqual(['3', 'Tipo de proyecto', 'VIS - Multifamiliar', '', 'project input', 'project input', 'Res. 0194 Anexo 3 (MS&C)', '21'])
    expect(rows[1].slice(1, 3)).toEqual(['Clima', 'Templado'])
    expect(byLabel(rows, 'Relación muro/ventana: fachada Norte').slice(2, 6)).toEqual(['0.00', '%', 'C-ENV', 'blocked'])
    expect(byLabel(rows, 'Duchas de bajo consumo').slice(2, 6)).toEqual(['0.00', 'L/min', 'C-WATER', 'missing'])
    const blank = mscRows({ ...fixtureBothRun, inputs: {} })
    expect(blank[0].slice(2, 6)).toEqual(['', '', 'project input', 'missing'])
  })

  describe('on 210 King', () => {
    const snapshot = load<Snapshot>('210king.json')
    const classifications = load<Classification[]>('210king.classifications.json')
    const accepted = proposeExclusions(snapshot, classifications).map((e) => ({ ...e, status: 'accepted' as const }))
    const run = computeRun(snapshot, classifications, accepted, { schemes: ['CASA'], inputs: { typology: 'no-vis', housingForm: 'multifamiliar' } }, undefined, 't')
    const rows = mscRows(run)
    const env = run.measures.find((m) => m.code === 'C-ENV')!

    test('the window-to-wall rows are the C-ENV cardinal rows as a percent', () => {
      const expected = ['N', 'S', 'E', 'W'].map((o) => ((env.orientations!.find((r) => r.orientation === o)!.wwr ?? 0) * 100).toFixed(2))
      expect(rows.filter((r) => r[0] === '25').map((r) => [r[2], r[4], r[5]])).toEqual(expected.map((v) => [v, 'C-ENV', 'geometry']))
      expect(Number(expected[1])).toBeGreaterThan(40)
    })

    test('every row cites an Anexo 3 page and the CSV carries the block after the design inputs', () => {
      for (const r of rows) expect([r[6], r[7]]).toEqual(['Res. 0194 Anexo 3 (MS&C)', expect.stringMatching(/^\d+$/)])
      const lines = inputsCsv(run, 'CASA').split('\r\n')
      expect(lines.indexOf('msc_field,label,value,unit,measure,source,guide_doc,guide_page')).toBeGreaterThan(1)
      expect(byLabel(rows, 'Altura del edificio')[5]).toBe('geometry')
    })
  })
})
