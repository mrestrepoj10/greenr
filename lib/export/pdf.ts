import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib'
import { citation } from '@/lib/edge/guide'
import { MEASURES } from '@/lib/edge/measures'
import { schemeOf, type MeasureCode, type MeasureResult, type RunResult } from '@/lib/edge/types'
import {
  MEASURE_TITLES,
  SCHEME_EXPORT,
  describeBlocker,
  describeExclusion,
  describeNorth,
  documentFileName,
  formatValue,
  type PackMeta,
} from './manifest'

export type ElevationImage = { label: string; png: Uint8Array }

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 42
const CONTENT_WIDTH = A4.width - 2 * MARGIN
const FOOTER_HEIGHT = 36
const BODY_SIZE = 9
const ROW_HEIGHT = 15
const INK = rgb(0.1, 0.1, 0.12)
const MUTED = rgb(0.4, 0.4, 0.45)
const RULE = rgb(0.75, 0.75, 0.78)
const HEADER_FILL = rgb(0.94, 0.94, 0.95)
/** Light fill behind every value that gets typed into the EDGE App, per Part 8 "values highlighted". */
const ENTERED_FILL = rgb(1, 0.96, 0.72)

type Column = { title: string; width: number; entered?: boolean }

/** Standard Helvetica is WinAnsi only, so anything outside it becomes a question mark instead of throwing mid-render. */
function safe(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width || !current) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

class Sheet {
  page!: PDFPage
  y = 0
  constructor(
    readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
    readonly footerText: string,
  ) {
    this.newPage()
  }

  newPage(): void {
    this.page = this.doc.addPage([A4.width, A4.height])
    this.y = A4.height - MARGIN
    const lines = wrap(this.footerText, this.font, 7, CONTENT_WIDTH)
    lines.forEach((line, i) => {
      this.page.drawText(line, { x: MARGIN, y: 14 + (lines.length - 1 - i) * 9, size: 7, font: this.font, color: MUTED })
    })
  }

  ensure(height: number): void {
    if (this.y - height < MARGIN + FOOTER_HEIGHT) this.newPage()
  }

  text(text: string, size = BODY_SIZE, font = this.font, color: RGB = INK): void {
    for (const line of wrap(text, font, size, CONTENT_WIDTH)) {
      this.ensure(size * 1.4)
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font, color })
      this.y -= size * 1.4
    }
  }

  heading(text: string): void {
    this.gap(8)
    this.text(text, 11, this.bold)
    this.gap(2)
  }

  gap(height: number): void {
    this.y -= height
  }

  table(columns: Column[], rows: string[][]): void {
    const drawRow = (cells: string[], fill: RGB | null, font: PDFFont, highlight: boolean) => {
      this.ensure(ROW_HEIGHT)
      let x = MARGIN
      columns.forEach((col, i) => {
        const cellFill = highlight && col.entered ? ENTERED_FILL : fill
        if (cellFill) {
          this.page.drawRectangle({ x, y: this.y - ROW_HEIGHT, width: col.width, height: ROW_HEIGHT, color: cellFill })
        }
        const [line] = wrap(cells[i] ?? '', font, BODY_SIZE, col.width - 6)
        this.page.drawText(line ?? '', { x: x + 3, y: this.y - ROW_HEIGHT + 4, size: BODY_SIZE, font, color: INK })
        x += col.width
      })
      this.page.drawLine({
        start: { x: MARGIN, y: this.y - ROW_HEIGHT },
        end: { x: MARGIN + CONTENT_WIDTH, y: this.y - ROW_HEIGHT },
        thickness: 0.5,
        color: RULE,
      })
      this.y -= ROW_HEIGHT
    }
    drawRow(
      columns.map((c) => c.title),
      HEADER_FILL,
      this.bold,
      false,
    )
    rows.forEach((row) => drawRow(row, null, this.font, true))
  }

  async image(label: string, png: Uint8Array): Promise<void> {
    this.newPage()
    this.text(label, 11, this.bold)
    this.gap(6)
    const embedded = await this.doc.embedPng(png)
    const maxHeight = this.y - MARGIN - FOOTER_HEIGHT
    const scale = Math.min(CONTENT_WIDTH / embedded.width, maxHeight / embedded.height, 1)
    const width = embedded.width * scale
    const height = embedded.height * scale
    this.page.drawImage(embedded, { x: MARGIN, y: this.y - height, width, height })
    this.y -= height
  }
}

function orientationTable(sheet: Sheet, measure: MeasureResult): void {
  const rows = measure.orientations ?? []
  if (rows.length === 0) return
  sheet.heading('EEM01 calculator inputs per orientation')
  sheet.text(
    'Gross facade area is walls plus windows and doors bounding conditioned space. Glazing includes frames and mullions. An orientation with no facade is entered as zero.',
    8,
    sheet.font,
    MUTED,
  )
  sheet.gap(4)
  sheet.table(
    [
      { title: 'Orientation', width: 60 },
      { title: 'Gross facade (m2)', width: 100, entered: true },
      { title: 'Glazing incl. frames (m2)', width: 120, entered: true },
      { title: 'WWR (%)', width: 65, entered: true },
      { title: 'Wall elements', width: 80 },
      { title: 'Glazing elements', width: 86 },
    ],
    rows.map((o) => [
      o.orientation,
      o.wallAreaM2.toFixed(2),
      o.glazingAreaM2.toFixed(2),
      ((o.wwr ?? 0) * 100).toFixed(2),
      String(o.wallDbIds.length),
      String(o.glazingDbIds.length),
    ]),
  )
}

export async function measurePdf(
  run: RunResult,
  code: MeasureCode,
  images: ElevationImage[],
  meta: PackMeta,
): Promise<Uint8Array> {
  const measure = run.measures.find((m) => m.code === code)
  if (!measure) throw new Error(`Run ${run.runId} has no measure ${code}`)
  const version = meta.version ?? 1
  const generatedAt = meta.generatedAt ?? new Date().toISOString()
  const fileName = documentFileName(code, version, 'pdf')
  const title = `${code} ${MEASURE_TITLES[code]}`
  const scheme = schemeOf(code)
  const strings = SCHEME_EXPORT[scheme]

  const doc = await PDFDocument.create()
  doc.setTitle(title)
  doc.setAuthor(meta.author)
  doc.setSubject(`${meta.projectName}, ${meta.modelName}`)
  doc.setProducer(`greenr ${meta.appVersion}`)
  doc.setCreator(`greenr ${meta.appVersion}`)
  doc.setCreationDate(new Date(generatedAt))
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const sheet = new Sheet(doc, font, bold, `${strings.disclaimer} ${fileName}, ${generatedAt}, ${meta.author}.`)

  sheet.text(title, 16, bold)
  sheet.text(meta.projectName, 11, font, MUTED)
  sheet.gap(8)
  sheet.table(
    [
      { title: 'Field', width: 120 },
      { title: 'Value', width: CONTENT_WIDTH - 120 },
    ],
    [
      ['Document', `${fileName}, version ${String(version).padStart(2, '0')}`],
      ['Date', generatedAt],
      ['Author', meta.author],
      ['Generated by', `greenr ${meta.appVersion}`],
      ['Model', meta.modelName],
      ['Model URN', run.snapshot.modelUrn],
      ['Viewable', run.snapshot.viewableName],
      ['Snapshot taken', run.snapshot.takenAt],
      ['Scheme', `${strings.name} ${run.guides[scheme]}`],
      ['Serves', MEASURES[code].credits.join(', ')],
      ['Guide', `${citation(measure.guide)}, ${measure.guide.title}`],
      ['Measure state', measure.blockedBy?.length ? `${measure.state}: ${measure.blockedBy.map(describeBlocker).join('; ')}` : measure.state],
    ],
  )

  sheet.heading(strings.inputsHeading)
  sheet.text(strings.enteredNote, 8, font, MUTED)
  sheet.gap(4)
  sheet.table(
    [
      { title: 'Input', width: 215 },
      { title: 'Value', width: 90, entered: true },
      { title: 'Unit', width: 56 },
      { title: 'Source', width: 70 },
      { title: 'Guide', width: 80 },
    ],
    measure.inputs.map((input) => [
      input.label,
      formatValue(input.value) || 'not in model',
      input.unit,
      input.source,
      `${measure.guide.doc} p. ${measure.guide.page}`,
    ]),
  )

  orientationTable(sheet, measure)

  sheet.heading('Gaps')
  if (measure.gaps.length === 0) sheet.text('No gaps. Every input for this measure was read from the model.', BODY_SIZE, font, MUTED)
  for (const gap of measure.gaps) {
    sheet.text(`${gap.severity}: ${gap.typeKey} is missing ${gap.missing} (${gap.dbIds.length} elements)`, BODY_SIZE, bold)
    sheet.text(gap.message)
    sheet.gap(3)
  }

  sheet.heading('Exclusions')
  if (run.exclusions.length === 0) sheet.text('None.', BODY_SIZE, font, MUTED)
  for (const exclusion of run.exclusions) sheet.text(describeExclusion(exclusion))

  sheet.heading('North convention')
  sheet.text(describeNorth(run.snapshot.north))

  for (const image of images) await sheet.image(image.label, image.png)

  const pages = doc.getPages()
  pages.forEach((page, i) => {
    const label = `Page ${i + 1} of ${pages.length}`
    page.drawText(label, {
      x: A4.width - MARGIN - font.widthOfTextAtSize(label, 7),
      y: 14 + 9 * 2,
      size: 7,
      font,
      color: MUTED,
    })
  })

  return doc.save()
}
