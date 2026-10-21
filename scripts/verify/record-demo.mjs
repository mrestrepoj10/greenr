#!/usr/bin/env node
// Records the README demo against BASE_URL: the model list, a check on 210 King, the W row,
// the gaps, acceptance in the panel, the agent question, and the export.
// Usage: BASE_URL=https://... [OUT_DIR=docs/media] [RAW_DIR=.verify-shots] node scripts/verify/record-demo.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { unzipSync } from 'fflate'
import { createBrowser } from './lib/browser.mjs'

const BASE_URL = (process.env.BASE_URL ?? 'https://greenr-omega.vercel.app').replace(/\/$/, '')
const OUT_DIR = resolve(process.env.OUT_DIR ?? 'docs/media')
const RAW_DIR = resolve(process.env.RAW_DIR ?? '.verify-shots')
const SESSION = process.env.AB_SESSION ?? `greenr-demo-${process.pid}`
const MODEL_NAME = '210_King_Arch.rvt'
const KEEP_WAIT_S = 2.5
const GIF_WIDTH = 960
const GIF_FPS = 10
const GIF_BUDGET = 8 * 1024 * 1024

const b = createBrowser({ session: SESSION, bypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const still = (name) => b.screenshot(join(OUT_DIR, `${name}.png`))
const pct = (v) => (v === null ? null : +(v * 100).toFixed(1))
/** Scrolls the nearest scrollable ancestor so the element sits in its middle. The page itself never moves. */
const scrollTo = (selector) =>
  b.evalJson(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return 'missing'
    let box = el.parentElement
    while (box && !(box.scrollHeight > box.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement
    if (!box) return 'no scroller'
    const delta = el.getBoundingClientRect().top - box.getBoundingClientRect().top - (box.clientHeight - el.offsetHeight) / 2
    box.scrollTo({ top: box.scrollTop + delta, behavior: 'smooth' })
    window.scrollTo(0, 0)
    return 'ok'
  })()`)
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()

const PANEL = `JSON.stringify({
  state: document.querySelector('[data-testid=run-state]')?.dataset.state,
  rows: [...document.querySelectorAll('[data-testid=wwr-row]')].map((r) => {
    const cells = [...r.querySelectorAll('td')].map((c) => c.textContent.trim())
    const ratio = cells[2]?.match(/(\\d+)%/)
    return { o: r.dataset.orientation, wall: cells[0], glazing: cells[1], wwr: ratio ? +ratio[1] / 100 : null }
  }),
  pending: document.querySelectorAll('[data-testid=pending-type]').length,
  exclusions: document.querySelectorAll('[data-testid=proposed-exclusion]').length,
  theming: (window.NOP_VIEWER?.model?.getFragmentList().db2ThemingColor || []).filter(Boolean).length,
  link: document.querySelector('[data-testid=export-link]')?.href ?? null,
})`

const AGENT = `JSON.stringify((() => {
  const s = document.querySelector('[data-testid=agent-section]')
  const q = document.querySelector('[data-testid=agent-question]')
  return { turn: s?.dataset.turn ?? null, question: q?.dataset.state ?? null }
})())`

/** Idle stretches of the recording, in seconds from record start. The cut keeps the edges of each. */
const waits = []
let recordStart = 0
const now = () => (Date.now() - recordStart) / 1000
async function waited(name, run) {
  const start = now()
  const value = await run()
  waits.push({ name, start, end: now() })
  return value
}
const pollUntil = async (read, done, timeoutMs, stepMs = 1500) => {
  const deadline = Date.now() + timeoutMs
  let value = read()
  while (!done(value) && Date.now() < deadline) {
    await sleep(stepMs)
    value = read()
  }
  return value
}

/** The ffmpeg select expression that drops the middle of every wait longer than twice the kept edge. */
function cutExpression(total) {
  const keep = []
  let cursor = 0
  for (const w of waits) {
    if (w.end - w.start <= 2 * KEEP_WAIT_S) continue
    keep.push([cursor, w.start + KEEP_WAIT_S])
    cursor = w.end - KEEP_WAIT_S
  }
  keep.push([cursor, total])
  return { expr: keep.map(([a, z]) => `between(t,${a.toFixed(2)},${z.toFixed(2)})`).join('+'), seconds: keep.reduce((s, [a, z]) => s + z - a, 0) }
}

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(RAW_DIR, { recursive: true })
const rawVideo = join(RAW_DIR, 'demo-raw.mp4')
let link = null
let confirmedRows = []

try {
  const catalog = await (await fetch(`${BASE_URL}/api/models`, { headers: b.fetchHeaders })).json()
  const model = catalog.models?.find((m) => m.name === MODEL_NAME)
  if (!model) throw new Error(`catalog has no ${MODEL_NAME}`)

  b.open(`${BASE_URL}/`)
  b.ab(['set', 'viewport', '1440', '900'])
  b.ab(['set', 'media', 'dark'])
  b.ab(['wait', `a[href="/p/${model.slug}"]`])
  await sleep(800)
  still('home')
  b.ab(['record', 'start', rawVideo, '--cursor', '--fps', '30'])
  recordStart = Date.now()
  await sleep(1500)

  b.ab(['hover', `a[href="/p/${model.slug}"]`])
  await sleep(600)
  b.click(`a[href="/p/${model.slug}"]`)
  await waited('model load', () => {
    b.waitFn('!!(window.NOP_VIEWER && window.NOP_VIEWER.model && window.NOP_VIEWER.model.isLoadDone())', 240_000)
    b.waitFn('!document.querySelector("[data-testid=check-edge]")?.disabled', 60_000)
  })
  await sleep(1500)

  b.ab(['hover', '[data-testid=check-edge]'])
  await sleep(500)
  b.click('[data-testid=check-edge]')
  await waited('check', async () => {
    b.waitFn('["provisional","confirmed"].includes(document.querySelector("[data-testid=run-state]")?.dataset.state)', 120_000)
    b.waitFn('document.querySelectorAll("[data-testid=wwr-row]").length === 8', 30_000)
    await pollUntil(() => b.evalJson(PANEL), (p) => p.theming > 0, 20_000, 500)
  })
  await sleep(1500)
  const provisional = b.evalJson(PANEL)
  console.log(`provisional WWR: ${provisional.rows.map((r) => `${r.o} ${pct(r.wwr)}%`).join(', ')}`)
  still('after-check')

  b.ab(['hover', '[data-testid=wwr-row][data-orientation=W]'])
  await sleep(600)
  b.click('[data-testid=wwr-row][data-orientation=W]')
  await sleep(2200)
  b.click('[data-testid=wwr-row][data-orientation=W]')
  await sleep(800)

  scrollTo('[data-testid=gaps-list]')
  await sleep(1800)
  still('gaps')

  scrollTo('[data-testid=confirmation-block]')
  await sleep(1000)
  for (let i = 0; i < 40; i++) {
    const open = b.evalJson(PANEL)
    if (open.exclusions === 0 && open.pending === 0) break
    const selector = open.exclusions > 0 ? '[data-testid=accept-exclusion]' : '[data-testid=confirm-type]'
    b.ab(['hover', selector])
    await sleep(250)
    b.click(selector)
    await sleep(450)
  }
  b.waitFn('document.querySelector("[data-testid=run-state]")?.dataset.state === "confirmed"', 30_000)
  await sleep(600)
  scrollTo('[data-testid=wwr-table]')
  await sleep(1200)
  const confirmed = b.evalJson(PANEL)
  confirmedRows = confirmed.rows
  console.log(`confirmed WWR: ${confirmed.rows.map((r) => `${r.o} ${r.wall}/${r.glazing} ${pct(r.wwr)}%`).join(', ')}`)
  still('confirm')

  const agent = await waited('agent question', () => pollUntil(() => b.evalJson(AGENT), (a) => a.question === 'waiting', 120_000))
  if (agent.question === 'waiting') {
    scrollTo('[data-testid=agent-question]')
    await sleep(800)
    b.evalJson(`(() => {
      for (const fs of document.querySelectorAll('[data-testid=agent-question] fieldset')) {
        const options = [...fs.querySelectorAll('[data-testid=agent-question-option]')]
        const pick = options.find((o) => /accept/i.test(o.textContent)) ?? options[0]
        ;(pick?.querySelector('input') ?? pick)?.click()
      }
      return 1
    })()`)
    await sleep(1200)
    still('agent')
    scrollTo('[data-testid=agent-question-submit]')
    await sleep(900)
    try {
      b.ab(['hover', '[data-testid=agent-question-submit]'])
      await sleep(300)
      b.click('[data-testid=agent-question-submit]')
    } catch {
      b.evalJson(`(() => { document.querySelector('[data-testid=agent-question-submit]').click(); return 1 })()`)
    }
    const after = await waited('agent answer', () => pollUntil(() => b.evalJson(AGENT), (a) => a.question === 'answered' && a.turn === 'idle', 180_000))
    console.log(`agent after the answer: question=${after.question} turn=${after.turn}`)
    b.evalJson(`(() => { document.querySelector('[data-testid=agent-transcript]')?.scrollTo?.(0, 1e9); return 1 })()`)
    await sleep(2000)
  } else {
    console.log('NOT VERIFIED: the agent asked no question within 120 s; agent.png not written')
  }

  scrollTo('[data-testid=export-pack]')
  await sleep(600)
  b.ab(['hover', '[data-testid=export-pack]'])
  await sleep(400)
  b.click('[data-testid=export-pack]')
  await waited('export', () => b.waitFn('!!document.querySelector("[data-testid=export-link]") || !!document.querySelector("[data-testid=export-failed]")', 240_000))
  await sleep(2500)
  link = b.evalJson(PANEL).link
  console.log(`export link: ${link}`)
  still('export')
  await sleep(1500)
} finally {
  try {
    console.log(b.ab(['record', 'stop']))
  } catch {}
  b.close()
}

const total = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', rawVideo]))
const { expr, seconds } = cutExpression(total)
console.log(`recording ${total.toFixed(1)} s, cut to ${seconds.toFixed(1)} s over ${waits.length} waits`)
writeFileSync(join(RAW_DIR, 'demo-waits.json'), JSON.stringify({ total, waits, expr }, null, 2))

const mp4 = join(OUT_DIR, 'demo.mp4')
sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawVideo, '-an', '-vf', `select='${expr}',setpts=N/FRAME_RATE/TB`, '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-pix_fmt', 'yuv420p', mp4])
console.log(`demo.mp4 ${(statSync(mp4).size / 1e6).toFixed(1)} MB`)

const gif = join(OUT_DIR, 'demo.gif')
for (const [fps, colors] of [[GIF_FPS, 128], [8, 96], [8, 64]]) {
  const filter = `select='${expr}',setpts=N/FRAME_RATE/TB,fps=${fps},scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawVideo, '-filter_complex', filter, gif])
  const size = statSync(gif).size
  console.log(`demo.gif ${fps} fps ${colors} colours: ${(size / 1e6).toFixed(1)} MB`)
  if (size <= GIF_BUDGET) break
}

if (link) {
  const packDir = mkdtempSync(join(tmpdir(), 'greenr-pack-'))
  const zip = unzipSync(new Uint8Array(await (await fetch(link)).arrayBuffer()))
  const pdfName = Object.keys(zip).find((n) => /^EEM01_.*\.pdf$/.test(n))
  if (!pdfName) throw new Error(`pack has no EEM01 PDF: ${Object.keys(zip).join(', ')}`)
  const pdfPath = join(packDir, pdfName)
  writeFileSync(pdfPath, zip[pdfName])
  sh('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '1', '-singlefile', pdfPath, join(OUT_DIR, 'pack-eem01')])
  console.log(`pack-eem01.png from ${pdfName} (${pdfPath})`)
}

console.log(`WWR after acceptance: ${confirmedRows.map((r) => `${r.o} ${pct(r.wwr)}%`).join(', ')}`)
console.log(`DONE ${OUT_DIR}`)
