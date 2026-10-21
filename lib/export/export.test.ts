import { PDFDocument } from 'pdf-lib'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, test } from 'vitest'
import { ORIENTATIONS } from '@/lib/edge/types'
import { edgeInputsCsv } from './csv'
import { fixtureMeta, fixtureRun } from './fixture'
import { buildManifest } from './manifest'
import { buildPack } from './pack'
import { measurePdf } from './pdf'
import { placeholderPng } from './placeholder-png'

const images = [
  { label: 'North elevation', png: placeholderPng(64, 32, [200, 220, 240]) },
  { label: 'South elevation', png: placeholderPng(64, 32, [240, 220, 200]) },
]

describe('edgeInputsCsv', () => {
  const lines = edgeInputsCsv(fixtureRun).split('\r\n')
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

  test('every row cites a guide part and page', () => {
    const rows = lines.filter((l) => l && !l.startsWith('measure,'))
    for (const row of rows) {
      const cells = row.split(',')
      expect(cells[cells.length - 2]).toMatch(/^[1-8]$/)
      expect(cells[cells.length - 1]).not.toBe('')
    }
  })

  test('the run without an EEM01 measure still writes eight zero rows', () => {
    const run = { ...fixtureRun, measures: fixtureRun.measures.filter((m) => m.code !== 'EEM01') }
    const rows = edgeInputsCsv(run).split('\r\n').filter((l) => l.startsWith('EEM01,'))
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
    expect(wwr).toMatchObject({ measure: 'EEM01', unit: '%', fileName: 'EEM01_Window_to_Wall_Ratio-01.pdf', guidePart: 3 })
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
    expect(strFromU8(entries['edge-inputs.csv'])).toBe(edgeInputsCsv(fixtureRun))
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
