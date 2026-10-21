#!/usr/bin/env node
// Usage: BASE_URL=http://localhost:3000 SHOTS_DIR=/path RUNS=3 node scripts/verify/unit2-engine.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const SHOTS_DIR = process.env.SHOTS_DIR ?? join(process.cwd(), '.verify-shots')
const SESSION = process.env.AB_SESSION ?? `greenr-unit2-${process.pid}`
const RUNS = Number(process.env.RUNS ?? 3)
const MODEL_NAME = '210_King_Arch.rvt'
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const FETCH_HEADERS = BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}
const BROWSER_HEADERS = BYPASS ? { ...FETCH_HEADERS, 'x-vercel-set-bypass-cookie': 'true' } : {}

// The spike table (m²) with the one deliberate correction: brick pier layers 451, 452, 453 on wall 445 count once.
const EXPECTED = {
  N: [1227.3, 401.1],
  NE: [0, 0],
  E: [627.6, 125.8],
  SE: [0, 0],
  S: [1281.1 - 57.9, 560.2],
  SW: [102.0, 27.3],
  W: [1024.0, 407.0],
  NW: [0, 0],
}
const COLORS = { N: [0.2, 0.4, 1], NE: [0.2, 0.8, 1], E: [0.2, 0.8, 0.3], SE: [0.7, 0.9, 0.2], S: [1, 0.25, 0.2], SW: [1, 0.6, 0.1], W: [1, 0.85, 0.1], NW: [0.7, 0.3, 1] }

const failures = []
function check(ok, label, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`)
  if (!ok) failures.push(label)
}

function ab(args, input) {
  return execFileSync('agent-browser', [...args, '--session', SESSION], {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
    timeout: 240_000,
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
}

// agent-browser prints JSON for objects and quoted strings, but a bare word for some plain strings.
const parse = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
const evalJson = (script) => {
  const out = parse(ab(['eval', '--stdin'], script))
  return typeof out === 'string' ? parse(out) : out
}

const within = (actual, expected) => (expected === 0 ? actual === 0 : Math.abs(actual - expected) / expected < 0.01)

mkdirSync(SHOTS_DIR, { recursive: true })
const bundle = join(mkdtempSync(join(tmpdir(), 'greenr-unit2-')), 'engine.js')
execFileSync(
  'pnpm',
  ['dlx', 'esbuild@0.25.10', 'scripts/verify/unit2-bundle.ts', '--bundle', '--format=iife', '--target=es2020', `--outfile=${bundle}`, '--log-level=warning'],
  { stdio: 'inherit' },
)

try {
  const catalog = await (await fetch(`${BASE_URL}/api/models`, { headers: FETCH_HEADERS })).json()
  const model = catalog.models?.find((m) => m.name === MODEL_NAME)
  check(Boolean(model), `catalog lists ${MODEL_NAME}`)

  const url = `${BASE_URL}/p/${model.slug}`
  ab(BYPASS ? ['open', url, '--headers', JSON.stringify(BROWSER_HEADERS)] : ['open', url])
  ab(['set', 'viewport', '1440', '900'])
  ab(['wait', '--fn', '!!(window.NOP_VIEWER && window.NOP_VIEWER.model && window.NOP_VIEWER.model.isLoadDone())', '--timeout', '180000'])
  ab(['eval', '--stdin'], readFileSync(bundle, 'utf8'))
  check(evalJson('typeof window.__greenr?.computeRun') === 'function', 'dev hook installed on window.__greenr')

  const result = evalJson(`(async () => {
    const g = window.__greenr, v = window.__greenrVerify, runs = []
    let snap, run, proposals
    for (let i = 0; i < ${RUNS}; i++) {
      const t0 = performance.now()
      snap = await g.readSnapshot()
      const t1 = performance.now()
      const cls = v.classifySnapshot(snap).merged
      proposals = g.proposeExclusions(snap, cls)
      const t2 = performance.now()
      run = g.computeRun(snap, cls, proposals.map((e) => ({ ...e, status: 'accepted' })), { schemes: ['EDGE'], inputs: {} })
      const t3 = performance.now()
      runs.push({ readSnapshotMs: t1 - t0, scanMs: snap.stats.propertyScanMs, geometryMs: snap.stats.geometryMs, proposeMs: t2 - t1, computeRunMs: t3 - t2 })
    }
    const m = (c) => run.measures.find((x) => x.code === c)
    const val = (c, label) => m(c).inputs.find((i) => i.label.startsWith(label)).value
    window.__unit2 = { run, proposals }
    return JSON.stringify({
      runs, units: snap.units, view: snap.viewableName, north: snap.north, stats: snap.stats, state: run.state,
      rows: m('EEM01').orientations.map((r) => ({ o: r.orientation, gross: r.wallAreaM2, glazing: r.glazingAreaM2, wwr: r.wwr, walls: r.wallDbIds.length })),
      wwr: m('EEM01').inputs[0].value,
      gia: val('D-GIA', 'Gross internal area'), above: val('D-FLOORS', 'Floors above grade'), below: val('D-FLOORS', 'Floors below grade'),
      ff: val('D-F2F', 'Floor-to-floor'), roof: val('D-ROOF', 'Aggregate roof area'), eem09Gaps: m('EEM09').gaps.length, eem02: m('EEM02').state,
      proposals: proposals.map((p) => p.id),
    })
  })()`)

  check(result.view === 'New Construction', 'snapshot from the master view', result.view)
  check(result.stats.missingGeometry === 0, 'every fragment had resident geometry', result.stats.missingGeometry)
  console.log('\norientation   gross m²   glazing m²   WWR      spike gross   spike glazing')
  for (const r of result.rows) {
    const [g, z] = EXPECTED[r.o]
    console.log(`${r.o.padEnd(12)} ${r.gross.toFixed(1).padStart(9)} ${r.glazing.toFixed(1).padStart(12)}   ${r.wwr === null ? '  n/a ' : `${(r.wwr * 100).toFixed(1)}%`.padStart(6)} ${g.toFixed(1).padStart(13)} ${z.toFixed(1).padStart(15)}`)
  }
  console.log(`overall WWR ${(result.wwr * 100).toFixed(1)}%\n`)
  for (const r of result.rows) {
    const [g, z] = EXPECTED[r.o]
    check(within(r.gross, g) && within(r.glazing, z), `EEM01 ${r.o} within 1% of the spike`, [+r.gross.toFixed(1), +r.glazing.toFixed(1)])
  }
  check(within(result.gia, 11901), 'GIA 11,901 m² within 1%', +result.gia.toFixed(1))
  check(result.above === 6 && result.below === 0, 'floors 6 above, 0 below', [result.above, result.below])
  check(within(result.ff, 3.548), 'floor-to-floor 3.548 m within 1%', +result.ff.toFixed(3))
  check(within(result.roof, 2104.6), 'roof 2,104.6 m² within 1%', +result.roof.toFixed(1))
  check(result.eem09Gaps > 0 && result.eem02 === 'blocked', 'gaps: EEM09 glazing data and EEM02 SRI', [result.eem09Gaps, result.eem02])
  check(result.state === 'confirmed', 'run settles once the rule exclusions are confirmed', result.state)

  const ms = (k) => result.runs.map((r) => Math.round(r[k]))
  console.log(`timings over ${RUNS} runs (ms): readSnapshot ${ms('readSnapshotMs')} (scan ${ms('scanMs')}, geometry ${ms('geometryMs')}), computeRun ${ms('computeRunMs')}, propose ${ms('proposeMs')}`)
  console.log(`snapshot: ${result.stats.elements} elements, ${result.stats.triangles} triangles, units ${result.units}, north ${JSON.stringify(result.north)}`)

  evalJson(`(() => {
    const v = window.NOP_VIEWER, m = v.model, { run, proposals } = window.__unit2
    const colors = ${JSON.stringify(COLORS)}
    v.clearThemingColors(m)
    v.hide(proposals.filter((p) => p.reason === 'massing').flatMap((p) => p.dbIds))
    const ids = []
    for (const r of run.measures.find((x) => x.code === 'EEM01').orientations) {
      const c = colors[r.orientation]
      for (const id of [...r.wallDbIds, ...r.glazingDbIds]) {
        v.setThemingColor(id, new THREE.Vector4(c[0], c[1], c[2], 1), m, true)
        ids.push(id)
      }
    }
    window.__unit2.facadeIds = ids
    return ids.length
  })()`)
  for (const [name, dir] of [
    ['sw', [-0.6, -0.8, 0.45]],
    ['ne', [0.6, 0.8, 0.45]],
  ]) {
    evalJson(`(() => {
      const v = window.NOP_VIEWER, nav = v.navigation
      v.fitToView(window.__unit2.facadeIds, v.model, true)
      const target = nav.getTarget().clone(), dist = nav.getPosition().distanceTo(target)
      const d = new THREE.Vector3(${dir.join(', ')}).normalize().multiplyScalar(dist * 0.9)
      nav.setWorldUpVector(new THREE.Vector3(0, 0, 1))
      nav.setView(target.clone().add(d), target)
      return true
    })()`)
    ab(['wait', '1500'])
    ab(['screenshot', join(SHOTS_DIR, `unit2-engine-210king-${name}.png`)])
  }
} catch (error) {
  check(false, 'script completed', String(error.message ?? error))
} finally {
  try {
    ab(['close'])
  } catch {}
}

console.log(failures.length === 0 ? `VERIFIED ${BASE_URL}` : `NOT VERIFIED ${BASE_URL}: ${failures.join('; ')}`)
process.exit(failures.length === 0 ? 0 : 1)
