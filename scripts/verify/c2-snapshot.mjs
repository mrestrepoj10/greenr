#!/usr/bin/env node
// Unit C2 check: TORRE A opens in "Nueva construcción" and the snapshot reader reads it in under a second, with the
// unplaced rooms flagged, the openings hosted and the HS model's plumbing fixtures counted.
// Usage: BASE_URL=http://localhost:3000 [SHOTS_DIR=...] [RUNS=3] [CAPTURE=1] node scripts/verify/c2-snapshot.mjs
// CAPTURE=1 also writes lib/edge/__fixtures__/torre-a.json.gz and torre-a-hs.json.gz from the live snapshots.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createBrowser, createChecks } from './lib/browser.mjs'

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const SHOTS_DIR = process.env.SHOTS_DIR ?? join(process.cwd(), '.verify-shots')
const RUNS = Number(process.env.RUNS ?? 3)
const CAPTURE = process.env.CAPTURE === '1'
const FIXTURES = join(import.meta.dirname, '../../lib/edge/__fixtures__')
const ARQ = 'TORRE A - ARQ v20.rvt'
const HS = 'TORRE A - HS plumbing.rvt'
const VIEW = 'Nueva construcción'
const ARQ_CATEGORIES = 'Walls|Curtain Panels|Windows|Doors|Roofs|Floors|Rooms|Mass|Generic Models'
const HS_CATEGORIES = 'Plumbing Fixtures|Revit Pipes$|Pipe Accessories'
const READ_BUDGET_MS = 1000

const b = createBrowser({ session: `greenr-c2-${process.pid}`, bypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET })
const { check, failures } = createChecks()
const median = (xs) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)]

mkdirSync(SHOTS_DIR, { recursive: true })
const bundle = join(mkdtempSync(join(tmpdir(), 'greenr-c2-')), 'c2.js')
execFileSync(
  'pnpm',
  ['dlx', 'esbuild@0.25.10', 'scripts/verify/c2-bundle.ts', '--bundle', '--format=iife', '--target=es2020', `--outfile=${bundle}`, '--log-level=warning'],
  { stdio: 'inherit' },
)

async function open(name) {
  const catalog = await (await fetch(`${BASE_URL}/api/models`, { headers: b.fetchHeaders })).json()
  const model = catalog.models?.find((m) => m.name === name)
  const picked = model?.viewables.find((v) => v.guid === model.preferredViewable)?.name
  check(model?.translation === 'success', `catalog lists ${name} as translated`, model?.translation)
  check(picked === VIEW, `catalog picks "${VIEW}" for ${name}`, picked)
  b.open(`${BASE_URL}/p/${model.slug}`)
  b.ab(['set', 'viewport', '1440', '900'])
  b.waitFn('!!(window.NOP_VIEWER && window.NOP_VIEWER.model && window.NOP_VIEWER.model.isLoadDone())', 300_000)
  b.ab(['eval', '--stdin'], readFileSync(bundle, 'utf8'))
  return b.evalJson('JSON.stringify(window.NOP_VIEWER.model.getDocumentNode().name())')
}

const readTimed = () =>
  b.evalJson(`(async () => {
    const runs = []
    for (let i = 0; i < ${RUNS}; i++) {
      await new Promise((r) => setTimeout(r, 300))
      const t0 = performance.now()
      window.__c2snap = await window.__greenr.readSnapshot()
      runs.push({ readMs: performance.now() - t0, scanMs: window.__c2snap.stats.propertyScanMs, geometryMs: window.__c2snap.stats.geometryMs })
    }
    return JSON.stringify({ runs, summary: window.__c2.summarize(window.__c2snap) })
  })()`)

const capture = (file, categories) => {
  const json = b.evalJson(`JSON.stringify(JSON.stringify(window.__c2.fixtureOf(window.__c2snap, /${categories}/)))`)
  const gz = gzipSync(Buffer.from(json, 'utf8'), { level: 9 })
  writeFileSync(join(FIXTURES, file), gz)
  console.log(`wrote ${file}: ${(json.length / 1e6).toFixed(1)} MB of JSON, ${(gz.length / 1e6).toFixed(2)} MB gzipped`)
  return gz.length
}

try {
  const loaded = await open(ARQ)
  check(loaded === VIEW, `the viewer loaded "${VIEW}"`, loaded)
  const { runs, summary: arq } = readTimed()
  const ms = (k) => runs.map((r) => Math.round(r[k]))
  console.log(`TORRE A ARQ over ${RUNS} runs (ms): readSnapshot ${ms('readMs')}, property scan ${ms('scanMs')}, geometry ${ms('geometryMs')}`)
  console.log(`elements ${arq.stats.elements}, triangles ${arq.stats.triangles}, levels ${arq.levels}`)
  console.log('categories', arq.categories)
  console.log('roles', arq.roles)
  check(arq.view === VIEW, `snapshot viewableName is "${VIEW}"`, arq.view)
  check(median(ms('readMs')) < READ_BUDGET_MS, `readSnapshot median under ${READ_BUDGET_MS} ms`, median(ms('readMs')))
  check(median(ms('scanMs')) < READ_BUDGET_MS, `property scan median under ${READ_BUDGET_MS} ms`, median(ms('scanMs')))
  check(arq.stats.missingGeometry === 0, 'every fragment had resident geometry', arq.stats.missingGeometry)
  check(arq.unplacedRooms === 73 && arq.categories['Revit Rooms'] === 73, '73 rooms, all flagged unplaced', [arq.unplacedRooms, arq.categories['Revit Rooms']])
  check(arq.roles.other >= 603 && arq.roles['curtain-glazed'] === 13, '603 "aire" panels are other, 13 Acristalado panels are glazing', [arq.roles.other, arq.roles['curtain-glazed']])
  console.log(`finish layers ${arq.finishLayers}; windows hosted ${arq.windows.hosted}/${arq.windows.total}; doors hosted ${arq.doors.hosted}/${arq.doors.total}; sliding glass doors hosted ${arq.slidingDoors.hosted}/${arq.slidingDoors.total} (${arq.slidingDoors.interior} marked Interior)`)
  check(arq.windows.hosted >= 0.95 * arq.windows.total && arq.windows.total === 267, '267 windows, at least 95% hosted', arq.windows)
  check(arq.doors.hosted >= 0.95 * arq.doors.total && arq.doors.total === 183, '183 doors, at least 95% hosted', arq.doors)
  check(arq.slidingDoors.interior === 137 && arq.slidingDoors.hosted >= 0.95 * arq.slidingDoors.total, 'the 137 Interior sliding glass doors find a host wall', arq.slidingDoors)
  check(arq.finishLayers > 0, 'finish layers are out of the façade', arq.finishLayers)
  if (CAPTURE) check(capture('torre-a.json.gz', ARQ_CATEGORIES) < 3e6, 'torre-a.json.gz under 3 MB')

  b.evalJson('(window.__c2.colour(window.__c2snap), true)')
  b.evalJson(`(() => {
    const v = window.NOP_VIEWER, nav = v.navigation
    v.fitToView()
    const target = nav.getTarget().clone(), dist = nav.getPosition().distanceTo(target)
    nav.setWorldUpVector(new THREE.Vector3(0, 0, 1))
    nav.setView(target.clone().add(new THREE.Vector3(-0.6, -0.8, 0.5).normalize().multiplyScalar(dist)), target)
    return true
  })()`)
  b.ab(['wait', '1500'])
  b.screenshot(join(SHOTS_DIR, 'c2-torre-a.png'))
  console.log(`screenshot ${join(SHOTS_DIR, 'c2-torre-a.png')}`)

  const loadedHs = await open(HS)
  check(loadedHs === VIEW, `the viewer loaded "${VIEW}" for the HS model`, loadedHs)
  const { runs: hsRuns, summary: hs } = readTimed()
  console.log(`TORRE A HS: readSnapshot ${hsRuns.map((r) => Math.round(r.readMs))} ms, elements ${hs.stats.elements}`)
  console.log('categories', hs.categories)
  check(hs.plumbingFixtures['Revit Plumbing Fixtures'] === 177, '177 plumbing fixtures (shower mixers), classified plumbing-fixture', hs.plumbingFixtures)
  check(hs.categories['Revit Pipes'] > 0 && hs.roles.pipe >= hs.categories['Revit Pipes'], 'pipes read and classified pipe', [hs.categories['Revit Pipes'], hs.roles.pipe])
  if (CAPTURE) check(capture('torre-a-hs.json.gz', HS_CATEGORIES) < 1e6, 'torre-a-hs.json.gz under 1 MB')
} catch (error) {
  check(false, 'script completed', String(error.message ?? error))
} finally {
  b.close()
}

console.log(failures.length === 0 ? `VERIFIED ${BASE_URL}` : `NOT VERIFIED ${BASE_URL}: ${failures.join('; ')}`)
process.exit(failures.length === 0 ? 0 : 1)
