#!/usr/bin/env node
// Unit C1 check: the scheme selector, the project inputs and the per-scheme sections on the real page, persisted through Convex.
// Usage: BASE_URL=http://localhost:3000 [SHOTS_DIR=...] node scripts/verify/c1-schemes.mjs
// Resets 210 King on the dev deployment before and after, like e2e.mjs.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createBrowser, createChecks } from './lib/browser.mjs'

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const SHOTS_DIR = process.env.SHOTS_DIR ?? join(process.cwd(), '.verify-shots')
const MODEL_NAME = '210_King_Arch.rvt'
const CASA_CODES = ['C-ENV', 'C-FLOOD', 'C-VENT', 'C-WATER', 'C-FLEX', 'C-SRI', 'C-GLAZE']

const b = createBrowser({ session: `greenr-c1-${process.pid}` })
const { check, failures } = createChecks()
const convex = (args) => execFileSync('npx', ['convex', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const json = (out) => JSON.parse(out.slice(out.search(/[{[]|null/)))
const shot = (name) => b.screenshot(join(SHOTS_DIR, `c1-${name}.png`))
const waitForModel = () =>
  b.waitFn('!!(window.NOP_VIEWER && window.NOP_VIEWER.model && window.NOP_VIEWER.model.isLoadDone())', 240_000)
const settled = () =>
  b.waitFn('["provisional","confirmed","exported"].includes(document.querySelector("[data-testid=run-state]")?.dataset.state)', 120_000)

const PANEL = `JSON.stringify({
  state: document.querySelector('[data-testid=run-state]')?.dataset.state,
  selector: Object.fromEntries([...document.querySelectorAll('[data-testid=scheme-option]')].map((o) => [o.dataset.value, o.getAttribute('aria-checked') === 'true'])),
  headings: [...document.querySelectorAll('[data-testid=scheme-heading]')].map((h) => h.textContent),
  casa: [...document.querySelectorAll('[data-testid=casa-measure]')].map((s) => {
    const link = s.querySelector('header a')
    return {
      code: s.dataset.code,
      chips: [...s.querySelectorAll('[data-testid=credit-chips] li')].map((l) => l.textContent),
      guide: link?.textContent,
      page: Number(link?.textContent.match(/p\\.(\\d+)$/)?.[1]),
      pdfPage: Number(link?.href.match(/#page=(\\d+)$/)?.[1]),
      blocked: s.querySelector('[data-testid=measure-blocked]')?.textContent ?? null,
    }
  }),
  eem01Chips: [...document.querySelectorAll('[data-testid=eem01] [data-testid=credit-chips] li')].map((l) => l.textContent),
  wwr: [...document.querySelectorAll('[data-testid=wwr-row]')].map((r) => r.querySelectorAll('td')[2]?.textContent.trim()),
  gapGuides: [...new Set([...document.querySelectorAll('[data-testid=gap-row] a')].map((a) => a.textContent))],
  form: document.querySelector('[data-testid=project-inputs]') ? {
    count: document.querySelector('[data-testid=project-inputs-count]')?.textContent,
    zone: document.querySelector('[data-testid=project-input-climateZone]')?.value,
    road: document.querySelector('[data-testid=project-input-roadGradeM]')?.value,
    geovisor: document.querySelector('[data-testid=climate-geovisor]')?.href,
  } : null,
  footer: document.querySelector('[data-testid=edge-panel] > footer')?.textContent,
  check: document.querySelector('[data-testid=check-edge]')?.textContent,
})`

mkdirSync(SHOTS_DIR, { recursive: true })

let slug = null
try {
  const catalog = await (await fetch(`${BASE_URL}/api/models`)).json()
  slug = catalog.models?.find((m) => m.name === MODEL_NAME)?.slug
  check(Boolean(slug), `catalog lists ${MODEL_NAME}`)
  convex(['run', 'admin:resetProject', JSON.stringify({ slug })])

  b.open(`${BASE_URL}/p/${slug}`)
  b.ab(['set', 'viewport', '1440', '900'])
  waitForModel()
  b.waitFn('!document.querySelector("[data-testid=check-edge]")?.disabled', 60_000)
  const rest = b.evalJson(PANEL)
  check(rest.selector.EDGE && !rest.selector.CASA && !rest.selector.both, 'a reset project selects EDGE only', rest.selector)
  check(rest.check === 'Check for EDGE' && rest.form === null, 'the button reads Check for EDGE and no project inputs show', rest.check)

  b.click('[data-testid=check-edge]')
  settled()
  const edge = b.evalJson(PANEL)
  check(edge.headings.length === 1 && edge.headings[0] === 'EDGE V3.1', 'an EDGE run renders one section headed EDGE V3.1', edge.headings)
  check(edge.casa.length === 0, 'no CASA sections in an EDGE run')
  check(JSON.stringify(edge.eem01Chips) === '["EEM01"]', 'the WWR section carries its EEM01 chip', edge.eem01Chips)
  check(edge.gapGuides.length > 0 && edge.gapGuides.every((g) => /^EDGE Part \d p\.\d+$/.test(g)), 'EDGE gaps cite "EDGE Part N p.NN"', edge.gapGuides)
  check(edge.footer === 'EDGE V3.1 user guides. Inputs only. Savings are calculated in the EDGE App.', 'the footer is the EDGE line alone', edge.footer)

  b.click('[data-testid=scheme-option][data-value=both]')
  b.waitFn('document.querySelectorAll("[data-testid=scheme-heading]").length === 2', 60_000)
  settled()
  const both = b.evalJson(PANEL)
  check(both.selector.both, 'EDGE + CASA is selected', both.selector)
  check(JSON.stringify(both.headings) === JSON.stringify(['EDGE V3.1', 'CASA Colombia 3.1 (Edición 2026)']), 'EDGE then CASA headings', both.headings)
  check(JSON.stringify(both.casa.map((c) => c.code)) === JSON.stringify(CASA_CODES), 'seven CASA sections in registry order', both.casa.map((c) => c.code))
  check(both.casa.every((c) => c.chips.length > 0), 'every CASA section shows its credit chips', both.casa.map((c) => `${c.code}: ${c.chips.join(' ')}`))
  check(
    both.casa.every((c) => /^CASA Colombia p\.\d+$/.test(c.guide) && c.pdfPage === c.page + 1),
    'every CASA guide link reads "CASA Colombia p.N" and opens PDF page N + 1',
    both.casa.map((c) => `${c.code} ${c.guide} #page=${c.pdfPage}`),
  )
  check(both.casa.every((c) => c.blocked?.startsWith('Not measured yet')), 'every CASA stub says it is not measured yet')
  check(JSON.stringify(both.wwr) === JSON.stringify(edge.wwr), 'adding CASA leaves the EDGE WWR rows as they were', both.wwr)
  check(both.form?.count === '0 of 11 set', 'the project inputs form shows, empty', both.form)
  check(both.form?.geovisor?.startsWith('https://geoportal.minvivienda.gov.co/'), 'the climate zone links the Minvivienda geovisor', both.form?.geovisor)
  check(both.footer?.includes('Credits are awarded by CCCS/GBCI on the Arc platform.') && both.footer.includes('Savings are calculated in the EDGE App.'), 'the footer carries both lines')
  shot('both')

  b.ab(['select', '[data-testid=project-input-climateZone]', 'templado'])
  b.ab(['fill', '[data-testid=project-input-roadGradeM]', '1502.4'])
  b.ab(['press', 'Enter'])
  b.waitFn('document.querySelector("[data-testid=project-inputs-count]")?.textContent === "2 of 11 set"', 30_000)
  settled()
  const typed = b.evalJson(PANEL)
  check(typed.form?.zone === 'templado' && typed.form.road === '1502.4', 'the climate zone and road grade take their values', typed.form)
  const stored = json(convex(['run', 'projects:getBySlug', JSON.stringify({ slug })]))
  check(
    JSON.stringify(stored.schemes) === '["EDGE","CASA"]' && stored.inputs.climateZone === 'templado' && stored.inputs.roadGradeM === 1502.4,
    'the project row holds both schemes and the two inputs',
    { schemes: stored.schemes, inputs: stored.inputs },
  )

  b.ab(['reload'])
  waitForModel()
  b.waitFn('document.querySelectorAll("[data-testid=scheme-heading]").length === 2', 240_000)
  b.waitFn('!document.querySelector("[data-testid=scheme-option]")?.disabled', 60_000)
  const reloaded = b.evalJson(PANEL)
  check(reloaded.selector.both && reloaded.form?.count === '2 of 11 set' && reloaded.form.zone === 'templado', 'reload keeps the selection and the inputs', reloaded.form)
  const latest = json(convex(['run', 'runs:latest', JSON.stringify({ projectId: stored._id })]))
  check(
    JSON.stringify(latest.run.schemes) === '["EDGE","CASA"]' && latest.run.inputs.climateZone === 'templado' && latest.run.measures.length === 15,
    'the stored run measured both schemes with the inputs',
    { schemes: latest.run.schemes, measures: latest.run.measures.length, inputs: latest.run.inputs },
  )

  b.click('[data-testid=scheme-option][data-value=CASA]')
  b.waitFn('document.querySelectorAll("[data-testid=scheme-heading]").length === 1', 120_000)
  settled()
  const casa = b.evalJson(PANEL)
  check(casa.headings[0] === 'CASA Colombia 3.1 (Edición 2026)' && casa.wwr.length === 0, 'CASA alone drops the EDGE sections', casa.headings)
  check(!/EDGE App/.test(casa.footer ?? ''), 'the CASA footer has no EDGE line', casa.footer)
  shot('casa')

  b.click('[data-testid=scheme-option][data-value=EDGE]')
  b.waitFn('document.querySelector("[data-testid=scheme-heading]")?.textContent === "EDGE V3.1"', 120_000)
  settled()
  const back = b.evalJson(PANEL)
  check(back.form === null && back.casa.length === 0 && JSON.stringify(back.wwr) === JSON.stringify(edge.wwr), 'back to EDGE: no form, no CASA, the same WWR', back.wwr)
} catch (error) {
  check(false, 'script completed', String(error.message ?? error))
} finally {
  b.close()
  if (slug) convex(['run', 'admin:resetProject', JSON.stringify({ slug })])
}

console.log(failures.length === 0 ? `VERIFIED ${BASE_URL}` : `NOT VERIFIED ${BASE_URL}: ${failures.join('; ')}`)
process.exit(failures.length === 0 ? 0 : 1)
