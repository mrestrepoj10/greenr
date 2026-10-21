#!/usr/bin/env node
// The done predicate in docs/plan.md, end to end against BASE_URL.
// Usage: BASE_URL=https://... [VERCEL_AUTOMATION_BYPASS_SECRET=...] [E2E_SKIP_AGENT=1] [E2E_RESET=0] [E2E_PROD=1] node scripts/verify/e2e.mjs
// The reset runs on the Convex production deployment when BASE_URL is the production host or E2E_PROD=1, else on dev.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import { createBrowser, createChecks } from './lib/browser.mjs'

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const SHOTS_DIR = process.env.SHOTS_DIR ?? join(process.cwd(), '.verify-shots')
const SESSION = process.env.AB_SESSION ?? `greenr-e2e-${process.pid}`
const SKIP_AGENT = process.env.E2E_SKIP_AGENT === '1'
const RESET = process.env.E2E_RESET !== '0'
const PROD_HOST = 'greenr-omega.vercel.app'
const PROD = process.env.E2E_PROD === '1' || new URL(BASE_URL).host === PROD_HOST
const MODEL_NAME = '210_King_Arch.rvt'
const EXPECTED_VIEW = 'New Construction'
const CHECK_BUDGET_MS = 60_000
const ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const MEASURE_PDFS = 8
const ELEVATIONS = 4
const ELEVATION_SIZE = '1600x1000'
const UNDONE = 'rule:party-wall'

const b = createBrowser({ session: SESSION, bypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET })
const { check, failures } = createChecks()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const shot = (name) => b.screenshot(join(SHOTS_DIR, `e2e-${name}.png`))
const pct = (v) => (v === null ? null : +(v * 100).toFixed(1))
const convex = (args) =>
  execFileSync('npx', ['convex', ...args, ...(PROD ? ['--prod'] : [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const waitForModel = () =>
  b.waitFn('!!(window.NOP_VIEWER && window.NOP_VIEWER.model && window.NOP_VIEWER.model.isLoadDone())', 240_000)

const VIEWER = `(() => {
  const v = window.NOP_VIEWER
  const frags = v.model.getFragmentList()
  return {
    theming: (frags.db2ThemingColor || []).filter(Boolean).length,
    selection: v.getSelection().length,
    isolated: v.getIsolatedNodes().length,
    envMap: v.prefs.get('envMapBackground'),
    bg: v.impl.clearColorTop ? v.impl.clearColorTop.toArray().map((c) => Math.round(c * 255)) : null,
  }
})()`

const PANEL = `JSON.stringify({
  state: document.querySelector('[data-testid=run-state]')?.dataset.state,
  rows: [...document.querySelectorAll('[data-testid=wwr-row]')].map((r) => {
    const cells = [...r.querySelectorAll('td')].map((c) => c.textContent.trim())
    const ratio = cells[2]?.match(/(\\d+)%/)
    return { o: r.dataset.orientation, wall: cells[0], glazing: cells[1], wwr: ratio ? +ratio[1] / 100 : null }
  }),
  pending: document.querySelectorAll('[data-testid=pending-type]').length,
  exclusions: [...document.querySelectorAll('[data-testid=proposed-exclusion]')].map((e) => e.dataset.exclusionId),
  decided: {
    open: document.querySelector('[data-testid=decided]')?.open ?? null,
    count: Number(document.querySelector('[data-testid=decided-count]')?.textContent ?? 0),
    exclusions: Object.fromEntries([...document.querySelectorAll('[data-testid=decided-exclusion]')].map((e) => [e.dataset.exclusionId, e.dataset.status])),
    types: [...document.querySelectorAll('[data-testid=decided-type]')].map((e) => e.dataset.typeKey),
  },
  inputs: [...document.querySelectorAll('[data-testid=design-input]')].map((d) => d.dataset.code + ' ' + d.querySelector('dt').textContent),
  gaps: [...document.querySelectorAll('[data-testid=gap-row]')].map((g) => ({ text: g.textContent, guide: /Part \\d p\\.\\d+/.test(g.textContent) })),
  exportDisabled: document.querySelector('[data-testid=export-pack]')?.disabled,
  stored: !!document.querySelector('[data-testid=stored-run]'),
  link: document.querySelector('[data-testid=export-link]')?.href ?? null,
  forbidden: /saving|\\bpass|\\bfail/i.test((document.querySelector('[data-testid=edge-panel]')?.innerText ?? '')
    .replace(document.querySelector('[data-testid=agent-section]')?.innerText ?? '', '')
    .replace(/Savings are calculated in the EDGE App\\./, '')),
  viewer: ${VIEWER},
})`

const AGENT = `JSON.stringify((() => {
  const s = document.querySelector('[data-testid=agent-section]')
  const q = document.querySelector('[data-testid=agent-question]')
  return {
    runtime: s?.dataset.runtime, turn: s?.dataset.turn,
    question: q?.dataset.state ?? null,
    questions: [...(q?.querySelectorAll('legend') ?? [])].map((l) => l.textContent),
    transcript: document.querySelector('[data-testid=agent-transcript]')?.innerText ?? '',
    cards: document.querySelectorAll('[data-testid=answer-cards]').length,
  }
})())`

/** Real numbers from the table: a gross and a glazing area per façade row, in m². */
const numeric = (cell) => Number((cell ?? '').replace(/,/g, ''))
const sameRows = (a, b) => a.rows.every((r, i) => r.wwr === b.rows[i].wwr)
const showRows = (p) => p.rows.filter((r) => r.wwr !== null).map((r) => `${r.o} ${pct(r.wwr)}%`)
const waitState = (state) => b.waitFn(`document.querySelector("[data-testid=run-state]")?.dataset.state === "${state}"`, 30_000)

mkdirSync(SHOTS_DIR, { recursive: true })

try {
  const catalog = await (await fetch(`${BASE_URL}/api/models`, { headers: b.fetchHeaders })).json()
  const model = catalog.models?.find((m) => m.name === MODEL_NAME)
  check(Boolean(model), `catalog lists ${MODEL_NAME}`, { count: catalog.models?.length })

  if (RESET) {
    const deployment = convex(['dashboard', '--no-open']).trim().split('/').pop()
    const out = convex(['run', 'admin:resetProject', JSON.stringify({ slug: model.slug })])
    console.log(`reset project on ${PROD ? 'prod' : 'dev'} deployment ${deployment}: ${out.replace(/\s+/g, ' ').trim()}`)
  }

  b.open(`${BASE_URL}/`)
  b.ab(['set', 'viewport', '1440', '900'])
  b.ab(['wait', `a[href="/p/${model.slug}"]`])
  b.click(`a[href="/p/${model.slug}"]`)
  waitForModel()
  b.waitFn('!document.querySelector("[data-testid=check-edge]")?.disabled', 60_000)
  const view = b.evalJson('window.NOP_VIEWER.model.getDocumentNode().name()')
  check(view === EXPECTED_VIEW, '1. model loaded in the New Construction view', view)
  const rest = b.evalJson(PANEL)
  check(rest.state === 'idle' && !rest.stored, 'a clean project shows no run before Check', rest.state)
  check(rest.exportDisabled === true, 'Export disabled before a run')
  check(rest.viewer.envMap === false && rest.viewer.bg?.every((c) => c <= 16), 'dark stage', rest.viewer.bg)
  check(rest.viewer.theming === 0, 'no theming before a run', rest.viewer.theming)
  shot('rest')

  const clicked = Date.now()
  b.click('[data-testid=check-edge]')
  b.waitFn('["provisional","confirmed"].includes(document.querySelector("[data-testid=run-state]")?.dataset.state)', 120_000)
  const elapsed = Date.now() - clicked
  check(elapsed < CHECK_BUDGET_MS, 'check finished within 60 s', `${(elapsed / 1000).toFixed(1)} s`)
  const after = b.evalJson(PANEL)
  check(after.rows.map((r) => r.o).join(',') === ORDER.join(','), '2. eight orientation rows in order', after.rows.map((r) => r.o))
  const facades = after.rows.filter((r) => r.wwr !== null)
  check(
    facades.length >= 4 && facades.every((r) => numeric(r.wall) > 0 && numeric(r.glazing) > 0),
    '2. façade rows carry real wall and glazing areas',
    facades.map((r) => `${r.o} ${r.wall}/${r.glazing} ${pct(r.wwr)}%`),
  )
  check(after.viewer.theming > 0, '2. façades coloured by WWR', after.viewer.theming)
  for (const code of ['D-GIA', 'D-FLOORS', 'D-F2F', 'D-ROOF', 'AU-SKYLIGHT']) {
    check(after.inputs.some((i) => i.startsWith(code)), `3. design input ${code}`, after.inputs.filter((i) => i.startsWith(code)))
  }
  check(after.inputs.some((i) => /below grade/i.test(i)), '3. floors below grade listed')
  check(after.gaps.some((g) => /EEM09/.test(g.text)) && after.gaps.some((g) => /EEM02/.test(g.text)), '4. glazing and roof gaps listed', after.gaps.length)
  check(after.gaps.every((g) => g.guide), '4. every gap carries its guide page')
  check(after.forbidden === false, 'no savings or pass/fail wording in the panel')
  check(after.exclusions.length > 0 && after.state === 'provisional', '5. proposed exclusions keep the run provisional', after.exclusions)
  console.log(`provisional WWR: ${after.rows.map((r) => `${r.o} ${pct(r.wwr)}%`).join(', ')}`)

  b.click('[data-testid=wwr-row][data-orientation=W]')
  const west = b.evalJson(`JSON.stringify(${VIEWER})`)
  check(west.selection > 0 && west.isolated > 0, '2. W row selects and isolates its walls', west.selection)
  b.click('[data-testid=wwr-row][data-orientation=W]')
  shot('after-check')

  let firstTurn = null
  if (SKIP_AGENT) {
    console.log('skip agent assertions (E2E_SKIP_AGENT=1)')
  } else {
    let agent = b.evalJson(AGENT)
    for (let i = 0; i < 90 && agent.question !== 'waiting'; i++) {
      await sleep(2000)
      agent = b.evalJson(AGENT)
    }
    check(agent.question === 'waiting', '5. the agent posted its first turn with a question', agent.runtime)
    firstTurn = agent.transcript
    console.log(`agent first turn:\n${agent.transcript.split('\n').filter((l) => l.trim()).map((l) => `  | ${l}`).join('\n')}`)
    b.evalJson(`(() => {
      const q = document.querySelector('[data-testid=agent-question]')
      q.scrollIntoView({ block: 'end' })
      for (const fs of q.querySelectorAll('fieldset')) fs.querySelector('input')?.click()
      return 1
    })()`)
    shot('agent-question')
    b.evalJson(`(() => { const s = document.querySelector('[data-testid=agent-question-submit]'); s.click(); return 1 })()`)
    for (let i = 0; i < 90; i++) {
      await sleep(2000)
      agent = b.evalJson(AGENT)
      if (agent.question === 'answered' && agent.turn === 'idle') break
    }
    check(agent.question === 'answered', 'the answer reached the agent', agent.question)
    check(agent.turn === 'idle', 'the agent finished its turn after the answer', agent.turn)
    console.log(`agent after the answer (${agent.cards} answer card blocks):\n${agent.transcript.slice(firstTurn.length).split('\n').filter((l) => l.trim()).map((l) => `  | ${l}`).join('\n')}`)
    check(
      !/\d+(\.\d+)?\s*%\s*(energy |water )?savings|\b(passes|fails|achieves) (the )?EDGE\b/i.test(agent.transcript),
      'the agent states no savings and no pass or fail',
    )
  }

  for (let i = 0; i < 40; i++) {
    const open = b.evalJson(PANEL)
    if (open.exclusions.length === 0 && open.pending === 0) break
    b.click(open.exclusions.length > 0 ? '[data-testid=accept-exclusion]' : '[data-testid=confirm-type]')
    await sleep(300)
  }
  b.waitFn('document.querySelector("[data-testid=run-state]")?.dataset.state === "confirmed"', 30_000)
  const confirmed = b.evalJson(PANEL)
  check(confirmed.state === 'confirmed', '5. badge reads confirmed after accepting every proposal', confirmed.state)
  const wwr = Object.fromEntries(confirmed.rows.map((r) => [r.o, pct(r.wwr)]))
  check(wwr.S >= 40 && wwr.S <= 50, '5. S WWR between 40 and 50 percent', wwr.S)
  check(wwr.N >= 30 && wwr.N <= 36, '5. N WWR between 30 and 36 percent', wwr.N)
  check(
    confirmed.rows.some((r, i) => r.wwr !== after.rows[i].wwr),
    '5. the numbers recompute when exclusions are accepted',
    confirmed.rows.map((r) => `${r.o} ${pct(r.wwr)}%`),
  )
  check(confirmed.exportDisabled === false, 'Export enabled once confirmed')
  check(
    confirmed.decided.open === false && confirmed.decided.count === after.exclusions.length + after.pending,
    '5. Decided lists every accepted proposal, collapsed',
    { count: confirmed.decided.count, accepted: Object.values(confirmed.decided.exclusions).filter((s) => s === 'accepted').length },
  )
  shot('confirm')

  b.click('[data-testid=decided] > summary')
  b.click(`[data-testid=decided-exclusion][data-exclusion-id="${UNDONE}"] [data-testid=undo-decision]`)
  waitState('provisional')
  const undone = b.evalJson(PANEL)
  check(
    undone.exclusions.includes(UNDONE) && !(UNDONE in undone.decided.exclusions),
    `5. Undo puts ${UNDONE} back under Needs your confirmation`,
    undone.exclusions,
  )
  check(!sameRows(undone, confirmed) && undone.exportDisabled === true, '5. the numbers revert and Export waits after an undo', showRows(undone))
  shot('undo')

  b.click(`[data-testid=proposed-exclusion][data-exclusion-id="${UNDONE}"] [data-testid=reject-exclusion]`)
  waitState('confirmed')
  const rejected = b.evalJson(PANEL)
  check(
    rejected.decided.exclusions[UNDONE] === 'rejected' && !rejected.exclusions.includes(UNDONE),
    '5. a rejected exclusion is listed under Decided as rejected',
    rejected.decided.exclusions[UNDONE],
  )
  check(sameRows(rejected, undone), '5. a rejected exclusion leaves its walls in the numbers', showRows(rejected))

  b.click(`[data-testid=decided-exclusion][data-exclusion-id="${UNDONE}"] [data-testid=undo-decision]`)
  waitState('provisional')
  check(b.evalJson(PANEL).exclusions.includes(UNDONE), '5. Undo returns a rejected exclusion to proposed')
  b.click(`[data-testid=proposed-exclusion][data-exclusion-id="${UNDONE}"] [data-testid=accept-exclusion]`)
  waitState('confirmed')
  const reaccepted = b.evalJson(PANEL)
  check(sameRows(reaccepted, confirmed), '5. accepting again restores the confirmed numbers', showRows(reaccepted))

  b.click('[data-testid=export-pack]')
  b.waitFn('!!document.querySelector("[data-testid=export-link]") || !!document.querySelector("[data-testid=export-failed]")', 240_000)
  const exported = b.evalJson(PANEL)
  check(Boolean(exported.link) && exported.state === 'exported', '6. export produced a Blob link and marked the run exported', exported.link)
  const head = await fetch(exported.link, { method: 'HEAD' })
  check(head.status === 200, '6. the share link answers HEAD 200', { status: head.status, bytes: head.headers.get('content-length') })
  const zip = unzipSync(new Uint8Array(await (await fetch(exported.link)).arrayBuffer()))
  const names = Object.keys(zip)
  const pdfs = names.filter((n) => n.endsWith('.pdf'))
  check(pdfs.length === MEASURE_PDFS, '6. one PDF per measure', pdfs)
  const imagesPerPage = Object.fromEntries(
    await Promise.all(
      pdfs.map(async (n) => {
        const pages = (await PDFDocument.load(zip[n])).getPages()
        const images = pages.map((p) => p.node.Resources()?.lookup(PDFName.of('XObject')))
        return [n.split('_')[0], images.map((x) => (x instanceof PDFDict ? x.keys().length : 0)).join('')]
      }),
    ),
  )
  check(
    Object.values(imagesPerPage).every((s) => new RegExp(`^0+1{${ELEVATIONS}}$`).test(s)),
    '6. every PDF has its table pages, then one page per elevation',
    imagesPerPage,
  )
  const csv = strFromU8(zip['edge-inputs.csv'] ?? new Uint8Array())
  const csvRows = csv.split('\n').filter((l) => l.startsWith('EEM01,') && ORDER.includes(l.split(',')[1]))
  check(csvRows.length === 8 && csvRows.some((l) => l.includes(',0.00,0.00,0.00,')), '6. CSV has eight EEM01 rows with explicit zeros', csvRows.length)
  console.log(`pack WWR (CSV, percent): ${csvRows.map((l) => `${l.split(',')[1]} ${l.split(',')[4]}`).join(', ')}`)
  const manifest = JSON.parse(strFromU8(zip['manifest.json'] ?? new Uint8Array()))
  check(manifest.runId && Array.isArray(manifest.documents), '6. JSON manifest lists the documents', manifest.documents?.length)
  const elevations = names.filter((n) => n.startsWith('elevations/'))
  const sizes = elevations.map((n) => {
    const view = new DataView(zip[n].buffer, zip[n].byteOffset)
    return `${view.getUint32(16)}x${view.getUint32(20)}`
  })
  check(elevations.length === ELEVATIONS, '6. four elevations in the pack', elevations)
  check(sizes.every((s) => s === ELEVATION_SIZE), `6. every elevation is ${ELEVATION_SIZE} whatever the canvas`, sizes)
  shot('export')

  b.ab(['reload'])
  waitForModel()
  b.waitFn('document.querySelectorAll("[data-testid=wwr-row]").length === 8', 120_000)
  const reloaded = b.evalJson(PANEL)
  check(reloaded.stored && reloaded.state === 'exported', '7. reload shows the last run without clicking', reloaded.state)
  check(reloaded.link === exported.link, '7. reload keeps the pack link', reloaded.link)
  check(sameRows(reloaded, confirmed), '7. reloaded WWR matches the confirmed run', showRows(reloaded))
  check(
    reloaded.decided.count === confirmed.decided.count && Object.values(reloaded.decided.exclusions).every((s) => s === 'accepted'),
    '7. reload keeps every decision under Decided',
    reloaded.decided.count,
  )
} catch (error) {
  check(false, 'script completed', String(error.message ?? error))
} finally {
  b.close()
}

console.log(failures.length === 0 ? `VERIFIED ${BASE_URL}` : `NOT VERIFIED ${BASE_URL}: ${failures.join('; ')}`)
process.exit(failures.length === 0 ? 0 : 1)
