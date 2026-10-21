#!/usr/bin/env node
// Unit 6 check: the evidence pack builds from the 210 King fixture, unzips to
// the expected listing, the EEM01 PDF renders, and the zip uploads to Blob when
// a token is present.
// Usage: node --import tsx scripts/verify/unit6-pack.mjs [OUT_DIR]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { buildPack } from '../../lib/export/pack.ts'
import { fixtureMeta, fixtureRun } from '../../lib/export/fixture.ts'
import { placeholderPng } from '../../lib/export/placeholder-png.ts'

const OUT_DIR = resolve(
  process.argv[2] ?? '/tmp/claude-1000/-home-exedev-projects/688cab1a-316a-4ba8-a2ff-eba6e5f877ff/scratchpad/shots',
)
const ZIP_PATH = join(OUT_DIR, 'unit6-pack.zip')
const PAGE_PNG = join(OUT_DIR, 'unit6-eem01-page1.png')
mkdirSync(OUT_DIR, { recursive: true })

const failures = []
function check(ok, label, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`)
  if (!ok) failures.push(label)
}

function which(bin) {
  try {
    return execFileSync('/bin/bash', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)="?([^"]*)"?$/.exec(line.trim())
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

const images = [
  { label: 'North elevation', png: placeholderPng(640, 360, [214, 228, 240]) },
  { label: 'South elevation', png: placeholderPng(640, 360, [240, 226, 210]) },
]

const started = Date.now()
const { zip, manifest } = await buildPack(fixtureRun, images, { ...fixtureMeta, generatedAt: new Date().toISOString() })
writeFileSync(ZIP_PATH, zip)
console.log(`pack built in ${Date.now() - started} ms, ${zip.byteLength} bytes, written to ${ZIP_PATH}`)

const entries = unzipSync(readFileSync(ZIP_PATH))
console.log('\nzip listing:')
for (const [name, bytes] of Object.entries(entries)) console.log(`  ${String(bytes.byteLength).padStart(8)}  ${name}`)
console.log()

const names = Object.keys(entries)
check(names[0] === 'manifest.json' && names[1] === 'edge-inputs.csv', 'manifest and CSV lead the listing')
check(
  fixtureRun.measures.every((m) => names.some((n) => n.startsWith(`${m.code}_`) && n.endsWith('.pdf'))),
  'one PDF per measure',
  fixtureRun.measures.map((m) => m.code),
)
check(names.filter((n) => n.endsWith('.pdf')).length === fixtureRun.measures.length, 'PDF count equals measure count')
check(
  names.filter((n) => n.startsWith('elevations/')).length === images.length,
  'elevations present',
  names.filter((n) => n.startsWith('elevations/')),
)
check(manifest.documents.every((d) => names.includes(d.fileName)), 'every manifest document is in the zip')

const csv = strFromU8(entries['edge-inputs.csv'])
const csvLines = csv.split('\r\n')
const blockStart = csvLines.findIndex((l) => l.startsWith('measure,orientation,wall_area_m2')) + 1
const blockEnd = csvLines.indexOf('', blockStart)
const eem01 = csvLines.slice(blockStart, blockEnd === -1 ? undefined : blockEnd)
check(eem01.length === 8, 'CSV has eight EEM01 rows', eem01.map((l) => l.split(',')[1]))
check(
  eem01.some((l) => /^EEM01,(NE|SW),0\.00,0\.00,0\.00,/.test(l)),
  'zero facades are explicit zeros',
  eem01.filter((l) => l.includes(',0.00,0.00,0.00,')),
)
check(!/saving|pass\/fail/i.test(csv), 'CSV never mentions savings or pass/fail')

const eem01Pdf = names.find((n) => n.startsWith('EEM01_'))
const pdfBytes = entries[eem01Pdf]
check(String.fromCharCode(...pdfBytes.subarray(0, 5)) === '%PDF-', 'EEM01 PDF has the PDF header', eem01Pdf)
const pdfPath = join(OUT_DIR, eem01Pdf)
writeFileSync(pdfPath, pdfBytes)

const pdftoppm = which('pdftoppm')
if (pdftoppm) {
  const prefix = PAGE_PNG.replace(/\.png$/, '')
  execFileSync(pdftoppm, ['-png', '-r', '110', '-f', '1', '-l', '1', '-singlefile', pdfPath, prefix], { stdio: 'inherit' })
  check(existsSync(PAGE_PNG), 'first PDF page rendered', PAGE_PNG)
  const pdfinfo = which('pdfinfo')
  if (pdfinfo) {
    const info = execFileSync(pdfinfo, [pdfPath], { encoding: 'utf8' })
    const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1])
    check(pages === 1 + images.length, 'page count is 1 plus elevations', pages)
  }
} else {
  console.log('skip pdftoppm not installed, no page render')
}

loadEnvLocal()
if (process.env.BLOB_READ_WRITE_TOKEN) {
  const { put } = await import('@vercel/blob')
  const uploadStarted = Date.now()
  const blob = await put(`packs/verify/${fixtureRun.runId}.zip`, zip, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/zip',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  console.log(`uploaded in ${Date.now() - uploadStarted} ms: ${blob.url}`)
  const head = await fetch(blob.url, { method: 'HEAD' })
  check(head.ok, 'uploaded zip is reachable', { status: head.status, length: head.headers.get('content-length') })
} else {
  console.log('skip BLOB_READ_WRITE_TOKEN not set, no upload')
}

if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.join('; ')}`)
  process.exit(1)
}
console.log('\nVERIFIED')
