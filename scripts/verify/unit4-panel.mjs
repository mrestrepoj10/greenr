#!/usr/bin/env node
// Unit 4 check: the EDGE panel runs the mock check on 210_King_Arch.rvt, every
// row drives the viewer, and the stage is dark.
// Usage: BASE_URL=http://localhost:3000 SHOTS_DIR=/path node scripts/verify/unit4-panel.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const SHOTS_DIR = process.env.SHOTS_DIR ?? join(process.cwd(), '.verify-shots')
const SESSION = process.env.AB_SESSION ?? `greenr-unit4-${process.pid}`
const MODEL_NAME = '210_King_Arch.rvt'
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const FETCH_HEADERS = BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}
const BROWSER_HEADERS = BYPASS ? { ...FETCH_HEADERS, 'x-vercel-set-bypass-cookie': 'true' } : FETCH_HEADERS

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
  }).trim()
}

function evalJson(script) {
  return JSON.parse(ab(['eval', '--stdin'], script))
}

function waitFn(fn, timeout = 60_000) {
  ab(['wait', '--fn', fn, '--timeout', String(timeout)])
}

function click(selector) {
  ab(['click', selector])
}

function shot(name) {
  ab(['screenshot', join(SHOTS_DIR, `${name}.png`)])
}

const VIEWER_STATE = `(() => {
  const v = window.NOP_VIEWER
  const frags = v.model.getFragmentList()
  const theming = (frags.db2ThemingColor || []).filter(Boolean).length
  const bg = v.impl.clearColorTop ? v.impl.clearColorTop.toArray().map((c) => Math.round(c * 255)) : null
  return {
    selection: v.getSelection().length,
    isolated: v.getIsolatedNodes().length,
    theming,
    bg,
    envMap: v.prefs.get('envMapBackground'),
  }
})()`

mkdirSync(SHOTS_DIR, { recursive: true })

try {
  const catalog = await (await fetch(`${BASE_URL}/api/models`, { headers: FETCH_HEADERS })).json()
  const model = catalog.models.find((m) => m.name === MODEL_NAME)
  check(Boolean(model), `catalog lists ${MODEL_NAME}`)

  const openArgs = ['open', `${BASE_URL}/p/${model.slug}`]
  ab(BYPASS ? [...openArgs, '--headers', JSON.stringify(BROWSER_HEADERS)] : openArgs)
  ab(['set', 'viewport', '1440', '900'])
  waitFn('!!(window.NOP_VIEWER && window.NOP_VIEWER.model && window.NOP_VIEWER.model.isLoadDone())', 180_000)
  waitFn('document.querySelector("[data-testid=viewer-state]")?.dataset.state === "loaded"')

  const rest = evalJson(`({
    panelState: document.querySelector('[data-testid=edge-panel]')?.dataset.state,
    empty: !!document.querySelector('[data-testid=panel-empty]'),
    emptyLines: document.querySelectorAll('[data-testid=panel-empty] li').length,
    checkEnabled: !document.querySelector('[data-testid=check-edge]')?.disabled,
    exportDisabled: document.querySelector('[data-testid=export-pack]')?.disabled,
    title: document.querySelector('[data-testid=model-name]')?.textContent,
    units: document.querySelector('[data-testid=units-chip]')?.textContent,
    dark: document.documentElement.classList.contains('dark'),
    viewer: ${VIEWER_STATE},
  })`)
  check(rest.panelState === 'idle' && rest.empty && rest.emptyLines === 3, 'panel at rest shows the three-line explanation', rest.panelState)
  check(rest.checkEnabled && rest.exportDisabled, 'Check enabled, Export disabled before a run')
  check(rest.title === MODEL_NAME, 'top bar shows the model name', rest.title)
  check(typeof rest.units === 'string' && rest.units.length > 0, 'top bar shows a units chip', rest.units)
  check(rest.dark && rest.viewer.envMap === false, 'stage has no light environment', rest.viewer.envMap)
  check(Array.isArray(rest.viewer.bg) && rest.viewer.bg.every((c) => c <= 16), 'stage background matches the dark page', rest.viewer.bg)
  check(rest.viewer.theming === 0, 'no theming before a run', rest.viewer.theming)
  shot('unit4-rest')

  click('[data-testid=check-edge]')
  waitFn('!!document.querySelector("[data-testid=panel-skeleton]")', 5_000)
  const measuring = evalJson(`({
    state: document.querySelector('[data-testid=edge-panel]')?.dataset.state,
    badge: document.querySelector('[data-testid=run-state]')?.textContent,
  })`)
  check(measuring.state === 'measuring', 'skeleton rows while measuring', measuring)

  waitFn('document.querySelectorAll("[data-testid=wwr-row]").length === 8', 15_000)
  const after = evalJson(`({
    state: document.querySelector('[data-testid=edge-panel]')?.dataset.state,
    rows: [...document.querySelectorAll('[data-testid=wwr-row]')].map((r) => r.dataset.orientation),
    noFacade: [...document.querySelectorAll('[data-testid=wwr-row]')].filter((r) => r.textContent.includes('no façade')).length,
    pending: document.querySelectorAll('[data-testid=pending-type]').length,
    exclusions: document.querySelectorAll('[data-testid=proposed-exclusion]').length,
    inputs: document.querySelectorAll('[data-testid=design-input]').length,
    gaps: document.querySelectorAll('[data-testid=gap-row]').length,
    guideLinks: [...document.querySelectorAll('a[href*="edgebuildings.com"]')].length,
    legend: (() => {
      const legend = document.querySelector('[data-testid=stage-legend]')
      if (!legend) return false
      const r = legend.getBoundingClientRect()
      const top = document.elementsFromPoint(r.left + 8, r.top + 8).find((e) => e.tagName !== 'NEXTJS-PORTAL')
      return legend.contains(top)
    })(),
    exportDisabled: document.querySelector('[data-testid=export-pack]')?.disabled,
    forbidden: /saving|pass|fail/i.test(document.querySelector('[data-testid=edge-panel]')?.textContent.replace(/Savings are calculated in the EDGE App\\./, '')),
    viewer: ${VIEWER_STATE},
  })`)
  check(after.state === 'provisional', 'run is provisional after the check', after.state)
  check(after.rows.join(',') === 'N,NE,E,SE,S,SW,W,NW', 'eight orientation rows in order', after.rows)
  check(after.noFacade === 3, 'orientations without a façade say so', after.noFacade)
  check(after.pending === 3 && after.exclusions === 2, 'three pending types and two proposed exclusions', [after.pending, after.exclusions])
  check(after.inputs >= 5, 'design inputs listed', after.inputs)
  check(after.gaps === 3, 'three gaps listed', after.gaps)
  check(after.guideLinks >= 8, 'every measure carries a guide link', after.guideLinks)
  check(after.viewer.theming > 0, 'façades coloured', after.viewer.theming)
  check(after.legend, 'legend chip sits above the canvas')
  check(after.exportDisabled === true, 'Export stays disabled while provisional')
  check(after.forbidden === false, 'no savings or pass/fail wording in the panel')
  shot('unit4-after-check')
  evalJson(`(document.querySelector('[data-testid=eem01]').scrollIntoView({ block: 'start' }), true)`)
  shot('unit4-wwr-table')

  click('[data-testid=wwr-row][data-orientation=W]')
  waitFn('window.NOP_VIEWER.getSelection().length > 0', 10_000)
  const west = evalJson(VIEWER_STATE)
  check(west.selection > 0, 'W row selects its elements', west.selection)
  check(west.isolated > 0, 'W row isolates its elements', west.isolated)
  check(west.theming > 0, 'theming colours applied', west.theming)

  click('[data-testid=gap-row]')
  waitFn(`window.NOP_VIEWER.getSelection().length > 0 && window.NOP_VIEWER.getSelection().length !== ${west.selection}`, 10_000)
  const gap = evalJson(VIEWER_STATE)
  check(gap.selection > 0 && gap.selection !== west.selection, 'gap click changes the selection', [west.selection, gap.selection])
  shot('unit4-gap-isolated')

  for (let i = 0; i < 3; i++) click('[data-testid=confirm-type]')
  click('[data-testid=accept-exclusion]')
  click('[data-testid=reject-exclusion]')
  waitFn('document.querySelector("[data-testid=edge-panel]")?.dataset.state === "confirmed"', 5_000)
  const confirmed = evalJson(`({
    pending: document.querySelectorAll('[data-testid=pending-type]').length,
    exclusions: document.querySelectorAll('[data-testid=proposed-exclusion]').length,
    exportEnabled: !document.querySelector('[data-testid=export-pack]')?.disabled,
  })`)
  check(confirmed.pending === 0 && confirmed.exclusions === 0 && confirmed.exportEnabled, 'confirming everything enables Export', confirmed)

  click('[data-testid=edit-north]')
  ab(['fill', '[data-testid=north-input]', '12.5'])
  ab(['press', 'Enter'])
  waitFn('document.querySelector("[data-testid=north-angle]")?.textContent.includes("12.5")', 5_000)
  check(true, 'north edit updates the compass')

  click('[data-testid=toggle-colour]')
  waitFn('!document.querySelector("[data-testid=stage-legend]")', 5_000)
  const cleared = evalJson(VIEWER_STATE)
  check(cleared.theming === 0, 'clearing colours removes theming', cleared.theming)
} catch (error) {
  check(false, 'script completed', String(error.message ?? error))
} finally {
  try {
    ab(['close'])
  } catch {}
}

console.log(failures.length === 0 ? `VERIFIED ${BASE_URL}` : `NOT VERIFIED ${BASE_URL}: ${failures.join('; ')}`)
process.exit(failures.length === 0 ? 0 : 1)
