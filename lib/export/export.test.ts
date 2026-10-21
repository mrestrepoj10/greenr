import { PDFDocument } from 'pdf-lib'
import { strFromU8, unzipSync, unzlibSync } from 'fflate'
import { describe, expect, test } from 'vitest'
import { ORIENTATIONS } from '@/lib/edge/types'
import { inputsCsv } from './csv'
import { fixtureBothRun, fixtureMeta, fixtureRun } from './fixture'
import { buildManifest } from './manifest'
import { buildPack } from './pack'
import { measurePdf } from './pdf'
import { placeholderPng } from './placeholder-png'

function pdfText(bytes: Uint8Array): string {
  const raw = strFromU8(bytes, true)
  const runs: string[] = []
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let body: string
    try {
      body = strFromU8(unzlibSync(Uint8Array.from(m[1], (c) => c.charCodeAt(0))), true)
    } catch {
      continue
    }
    for (const t of body.matchAll(/<([0-9A-Fa-f]*)> Tj/g)) runs.push(String.fromCharCode(...(t[1].match(/../g) ?? []).map((h) => parseInt(h, 16))))
  }
  return runs.join(' ')
}

const images = [
  { label: 'North elevation', png: placeholderPng(64, 32, [200, 220, 240]) },
  { label: 'South elevation', png: placeholderPng(64, 32, [240, 220, 200]) },
]

describe('inputsCsv for EDGE', () => {
  const lines = inputsCsv(fixtureRun, 'EDGE').split('\r\n')
  const headerIndex = lines.findIndex((l) => l.startsWith('measure,orientation,wall_area_m2'))
  const eem01 = lines.slice(headerIndex + 1, headerIndex + 9)

  test('EEM01 block has exactly eight orientation rows in calculator order', () => {
    expect(headerIndex).toBeGreaterThan(0)
    expect(eem01.map((l) => l.split(',')[1])).toEqual([...ORIENTATIONS])
    expect(lines[headerIndex + 9]).toBe('')
  })

  test('an orientation with no facade is written as explicit zeros', () => {
    const ne = eem01[1].split(',')
    const sw = eem01[5].split(',')
    expect(ne.slice(0, 5)).toEqual(['EEM01', 'NE', '0.00', '0.00', '0.00'])
    expect(sw.slice(0, 5)).toEqual(['EEM01', 'SW', '0.00', '0.00', '0.00'])
  })

  test('a facade row carries areas to two decimals and the WWR as a percent', () => {
    expect(eem01[0].split(',').slice(0, 5)).toEqual(['EEM01', 'N', '2840.50', '1250.20', '44.01'])
  })

  test('every row cites a guide document and page', () => {
    const rows = lines.filter((l) => l && !l.startsWith('measure,'))
    for (const row of rows) {
      const cells = row.split(',')
      expect(cells[cells.length - 2]).toMatch(/^EDGE Part [238]$/)
      expect(cells[cells.length - 1]).not.toBe('')
    }
  })

  test('the run without an EEM01 measure still writes eight zero rows', () => {
    const run = { ...fixtureRun, measures: fixtureRun.measures.filter((m) => m.code !== 'EEM01') }
    const rows = inputsCsv(run, 'EDGE').split('\r\n').filter((l) => l.startsWith('EEM01,'))
    expect(rows).toHaveLength(8)
    expect(rows.every((r) => r.includes(',0.00,0.00,0.00,'))).toBe(true)
  })
})

describe('buildManifest', () => {
  const manifest = buildManifest(fixtureRun, fixtureMeta, images.map((i) => i.label))

  test('every PDF is named <Measure>_<Title>-<NN>.pdf', () => {
    const pdfs = manifest.documents.filter((d) => d.kind === 'pdf')
    expect(pdfs).toHaveLength(fixtureRun.measures.length)
    for (const d of pdfs) expect(d.fileName).toMatch(/^[A-Z0-9-]+_[A-Za-z0-9_]+-\d{2}\.pdf$/)
    expect(pdfs.find((d) => d.measure === 'EEM01')?.fileName).toBe('EEM01_Window_to_Wall_Ratio-01.pdf')
  })

  test('the version flows into every file name', () => {
    const v2 = buildManifest(fixtureRun, { ...fixtureMeta, version: 2 })
    expect(v2.documents.find((d) => d.measure === 'EEM02')?.fileName).toBe('EEM02_Reflective_Roof-02.pdf')
  })

  test('carries the disclaimer, the date and the parameter cross-reference', () => {
    expect(manifest.disclaimer).toBe('Inputs only. Savings are calculated in the EDGE App.')
    expect(manifest.generatedAt).toBe(fixtureMeta.generatedAt)
    const wwr = manifest.parameters.find((p) => p.label === 'Area-weighted WWR')
    expect(wwr).toMatchObject({ measure: 'EEM01', unit: '%', fileName: 'EEM01_Window_to_Wall_Ratio-01.pdf', guideDoc: 'EDGE Part 3', guidePage: '14' })
  })

  test('never mentions savings or pass and fail', () => {
    const text = JSON.stringify(manifest).toLowerCase().replace('savings are calculated in the edge app', '')
    expect(text).not.toMatch(/saving|pass\b|fail/)
  })
})

describe('measurePdf', () => {
  test('is a PDF with one page of tables plus one page per elevation', async () => {
    const bytes = await measurePdf(fixtureRun, 'EEM01', images, fixtureMeta)
    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1 + images.length)
    expect(doc.getTitle()).toBe('EEM01 Window to Wall Ratio')
    expect(doc.getAuthor()).toBe(fixtureMeta.author)
  })

  test('a measure without elevations is a single page', async () => {
    const doc = await PDFDocument.load(await measurePdf(fixtureRun, 'D-GIA', [], fixtureMeta))
    expect(doc.getPageCount()).toBe(1)
  })

  test('rejects a measure the run does not carry', async () => {
    const run = { ...fixtureRun, measures: fixtureRun.measures.filter((m) => m.code !== 'EEM02') }
    await expect(measurePdf(run, 'EEM02', [], fixtureMeta)).rejects.toThrow(/EEM02/)
  })
})

describe('buildPack', () => {
  test('lists the manifest, the CSV, one PDF per measure and the elevations in a fixed order', async () => {
    const { zip, manifest } = await buildPack(fixtureRun, images, fixtureMeta)
    const entries = unzipSync(zip)
    expect(Object.keys(entries)).toEqual([
      'manifest.json',
      'edge-inputs.csv',
      ...fixtureRun.measures.map((m) => manifest.documents.find((d) => d.measure === m.code && d.kind === 'pdf')!.fileName),
      'elevations/North_elevation.png',
      'elevations/South_elevation.png',
    ])
    expect(JSON.parse(strFromU8(entries['manifest.json']))).toEqual(manifest)
    expect(strFromU8(entries['edge-inputs.csv'])).toBe(inputsCsv(fixtureRun, 'EDGE'))
    expect(entries['elevations/North_elevation.png']).toEqual(images[0].png)
    for (const d of manifest.documents) expect(entries[d.fileName], d.fileName).toBeDefined()
  })

  test('every measure PDF carries the elevation pages', async () => {
    const { zip, manifest } = await buildPack(fixtureRun, images, fixtureMeta)
    const entries = unzipSync(zip)
    for (const m of fixtureRun.measures) {
      const file = manifest.documents.find((d) => d.measure === m.code && d.kind === 'pdf')!.fileName
      const doc = await PDFDocument.load(entries[file])
      expect(doc.getPageCount(), m.code).toBe(1 + images.length)
    }
  })
})

describe('a run checked for EDGE and CASA', () => {
  test('writes one CSV per scheme; the EDGE file is the one an EDGE-only run writes', () => {
    expect(inputsCsv(fixtureBothRun, 'EDGE')).toBe(inputsCsv(fixtureRun, 'EDGE'))
    const casa = inputsCsv(fixtureBothRun, 'CASA').split('\r\n')
    expect(casa.slice(0, 6)).toEqual([
      'measure,label,value,unit,source,guide_doc,guide_page',
      'C-ENV,Roof area,412.50,m²,parameter,CASA Colombia,30',
      'C-WATER,Ducha: MezcladorDucha / Ducha,,L/min,parameter,CASA Colombia,125',
      'C-FLOOD,Lowest habitable floor,2.40,m,rooms,CASA Colombia,68',
      '',
      'msc_field,label,value,unit,measure,source,guide_doc,guide_page',
    ])
    expect(casa.at(-1)).toBe('')
  })

  test('the manifest names both schemes, both guide versions and both disclaimers', () => {
    const manifest = buildManifest(fixtureBothRun, fixtureMeta)
    expect(manifest.schemes).toEqual(['EDGE', 'CASA'])
    expect(manifest.guides).toEqual({ EDGE: 'V3.1', CASA: '3.1 (Edición 2026)' })
    expect(manifest.disclaimer).toBe(
      'Inputs only. Savings are calculated in the EDGE App. Pre-check only. Credits are awarded by CCCS/GBCI on the Arc platform.',
    )
    expect(manifest.documents.filter((d) => d.kind === 'csv').map((d) => [d.fileName, d.title])).toEqual([
      ['edge-inputs.csv', 'EDGE App inputs'],
      ['casa-inputs.csv', 'CASA Colombia pre-check inputs'],
    ])
    expect(manifest.documents.find((d) => d.measure === 'C-ENV')?.fileName).toBe('C-ENV_Envelope_Sheet-01.pdf')
    const text = JSON.stringify(manifest).toLowerCase().replace('savings are calculated in the edge app', '')
    expect(text).not.toMatch(/saving|pass\b|fail/)
  })

  test('the pack lists the manifest, the EDGE CSV, the CASA CSV, then every PDF in run order', async () => {
    const { zip, manifest } = await buildPack(fixtureBothRun, [], fixtureMeta)
    const names = Object.keys(unzipSync(zip))
    expect(names.slice(0, 3)).toEqual(['manifest.json', 'edge-inputs.csv', 'casa-inputs.csv'])
    expect(names.slice(3)).toEqual(fixtureBothRun.measures.map((m) => manifest.documents.find((d) => d.measure === m.code)!.fileName))
  })

  test('a CASA PDF carries the CASA heading, disclaimer, credits and citation, and says why it is blocked', async () => {
    const text = pdfText(await measurePdf(fixtureBothRun, 'C-FLOOD', [], fixtureMeta))
    expect(text).toContain('Pre-check only. Credits are awarded by CCCS/GBCI on the Arc platform.')
    expect(text).toContain('Inputs for the CASA Colombia pre-check')
    expect(text).toContain('CASA Colombia 3.1 (Edici\u00f3n 2026)')
    expect(text).toContain('CCRp3, CCRc4')
    expect(text).toContain('CASA Colombia, 3.1 (Edici\u00f3n 2026), p. 68')
    expect(text).toContain('blocked. Needs Road grade elevation under Project inputs.')
    expect(text).not.toContain('EDGE App')
  })

  test('an EDGE PDF keeps the EDGE wording', async () => {
    const text = pdfText(await measurePdf(fixtureBothRun, 'EEM01', [], fixtureMeta))
    expect(text).toContain('Inputs only. Savings are calculated in the EDGE App.')
    expect(text).toContain('Inputs for the EDGE App')
    expect(text).toContain('EDGE Part 3, V3.1, p. 14')
    expect(text).not.toContain('CASA')
  })

  test('a CASA PDF cites each credit it serves with its own page, and the thresholds the values crossed', async () => {
    const text = pdfText(await measurePdf(fixtureBothRun, 'C-WATER', [], fixtureMeta))
    expect(text).toContain('Credits and pages')
    expect(text).toContain('Ap3 (Reducci\u00f3n del consumo de agua interior): CASA Colombia, 3.1 (Edici\u00f3n 2026), p. 124.')
    expect(text).toContain('Thresholds the values crossed')
    expect(text).toContain('above the NTC 1500 maximum of 8.3 L/min')
    expect(text).toContain('blocked. Needs Flow or Flow Rate on the element types listed below, from their data sheets.')
  })
})

describe('elevations in a CASA pack', () => {
  const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount()
  const envWithRows = {
    ...fixtureBothRun,
    measures: fixtureBothRun.measures.map((m) => (m.code === 'C-ENV' ? { ...m, orientations: fixtureRun.measures.find((x) => x.code === 'EEM01')!.orientations } : m)),
  }

  test('only C-ENV carries them, and only when it measured its façades', async () => {
    const withImages = await pages(await measurePdf(envWithRows, 'C-ENV', images, fixtureMeta))
    const without = await pages(await measurePdf(envWithRows, 'C-ENV', [], fixtureMeta))
    expect(withImages - without).toBe(images.length)
    for (const code of ['C-FLOOD', 'C-WATER'] as const) {
      expect(await pages(await measurePdf(envWithRows, code, images, fixtureMeta))).toBe(await pages(await measurePdf(envWithRows, code, [], fixtureMeta)))
    }
    const blocked = await pages(await measurePdf(fixtureBothRun, 'C-ENV', images, fixtureMeta))
    expect(blocked).toBe(await pages(await measurePdf(fixtureBothRun, 'C-ENV', [], fixtureMeta)))
  })

  test('an EDGE PDF still carries every elevation', async () => {
    const withImages = await pages(await measurePdf(fixtureBothRun, 'D-GIA', images, fixtureMeta))
    expect(withImages - (await pages(await measurePdf(fixtureBothRun, 'D-GIA', [], fixtureMeta)))).toBe(images.length)
  })
})
