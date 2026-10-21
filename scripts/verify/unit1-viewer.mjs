#!/usr/bin/env node
// Unit 1 check: the model list renders, 210_King_Arch.rvt opens in the
// "New Construction" viewable, and that viewable carries Revit Rooms.
// Usage: BASE_URL=https://... SHOTS_DIR=/path node scripts/verify/unit1-viewer.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const SHOTS_DIR = process.env.SHOTS_DIR ?? join(process.cwd(), '.verify-shots')
const SESSION = process.env.AB_SESSION ?? `greenr-verify-${process.pid}`
const MODEL_NAME = '210_King_Arch.rvt'
const EXPECTED_VIEW = 'New Construction'
const MIN_ROOMS = 200
// A protected Vercel preview accepts either the project's automation bypass
// secret or the linked project's development OIDC token. Neither is logged.
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const OIDC = process.env.VERCEL_OIDC_TOKEN
const FETCH_HEADERS = BYPASS
  ? { 'x-vercel-protection-bypass': BYPASS }
  : OIDC
    ? { 'x-vercel-trusted-oidc-idp-token': OIDC }
    : {}
// The cookie makes the page's own requests (viewer token, assets) pass too.
const BROWSER_HEADERS = BYPASS ? { ...FETCH_HEADERS, 'x-vercel-set-bypass-cookie': 'true' } : FETCH_HEADERS
const AUTHED = Object.keys(FETCH_HEADERS).length > 0

const failures = []
function check(ok, label, detail) {
  const line = `${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`
  console.log(line)
  if (!ok) failures.push(label)
}

function ab(args, input) {
  const out = execFileSync('agent-browser', [...args, '--session', SESSION], {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
    timeout: 240_000,
  })
  return out.trim()
}

function open(url) {
  ab(AUTHED ? ['open', url, '--headers', JSON.stringify(BROWSER_HEADERS)] : ['open', url])
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, { headers: FETCH_HEADERS })
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return response.json()
}

function evalJson(script) {
  const out = ab(['eval', '--stdin'], script)
  return JSON.parse(out)
}

mkdirSync(SHOTS_DIR, { recursive: true })

try {
  const catalog = await getJson('/api/models')
  const model = catalog.models?.find((m) => m.name === MODEL_NAME)
  check(Boolean(model), `catalog lists ${MODEL_NAME}`, { count: catalog.models?.length })
  const preferred = model?.viewables.find((v) => v.guid === model.preferredViewable)
  check(preferred?.name === EXPECTED_VIEW, 'catalog prefers the master view', preferred?.name)

  const token = await getJson('/api/viewer-token')
  check(typeof token.accessToken === 'string' && token.expiresInSeconds > 0, 'viewer token route')

  open(`${BASE_URL}/`)
  ab(['wait', '[data-testid=model-card]'])
  const home = evalJson(`({
    cards: document.querySelectorAll('[data-testid=model-card]').length,
    link: !!document.querySelector('a[href="/p/${model?.slug ?? ''}"]'),
  })`)
  check(home.cards >= 1, 'home renders model cards', home.cards)
  check(home.link, 'home links to the 210 King project page')
  ab(['screenshot', join(SHOTS_DIR, 'unit1-home.png')])

  open(`${BASE_URL}/p/${model.slug}`)
  ab([
    'wait',
    '--fn',
    '!!(window.NOP_VIEWER && window.NOP_VIEWER.model && window.NOP_VIEWER.model.isLoadDone())',
    '--timeout',
    '180000',
  ])
  ab(['wait', '--fn', 'document.querySelector("[data-testid=viewer-state]")?.dataset.state === "loaded"', '--timeout', '60000'])
  const loaded = evalJson(`(() => {
    const m = window.NOP_VIEWER.model
    const node = m.getDocumentNode()
    return {
      viewable: node && node.name(),
      rootId: m.getInstanceTree() && m.getInstanceTree().getRootId(),
      title: document.querySelector('[data-testid=model-name]')?.textContent,
      panel: !!document.querySelector('[data-testid=edge-panel]'),
    }
  })()`)
  check(loaded.viewable === EXPECTED_VIEW, 'viewer opened the named viewable', loaded.viewable)
  check(typeof loaded.rootId === 'number', 'instance tree has a root', loaded.rootId)
  check(loaded.title === MODEL_NAME, 'top bar shows the model name', loaded.title)
  check(loaded.panel, 'right panel renders')

  const rooms = evalJson(`new Promise((resolve, reject) => {
    const m = window.NOP_VIEWER.model
    m.getBulkProperties([], { propFilter: ['Category'] }, (res) => {
      let rooms = 0
      for (const r of res) {
        const cat = r.properties.find((p) => p.displayName === 'Category')
        if (cat && cat.displayValue === 'Revit Rooms') rooms++
      }
      resolve({ rooms, elements: res.length })
    }, reject)
  })`)
  check(rooms.rooms >= MIN_ROOMS, `viewable carries Revit Rooms (>= ${MIN_ROOMS})`, rooms)
  ab(['screenshot', join(SHOTS_DIR, 'unit1-project-210king.png')])
} catch (error) {
  check(false, 'script completed', String(error.message ?? error))
} finally {
  try {
    ab(['close'])
  } catch {}
}

console.log(failures.length === 0 ? `VERIFIED ${BASE_URL}` : `NOT VERIFIED ${BASE_URL}: ${failures.join('; ')}`)
process.exit(failures.length === 0 ? 0 : 1)
