#!/usr/bin/env node
// Unit 7 check: the Convex functions persist a project with its schemes and inputs, a run with its element
// ids split into runElements, user classifications that win over rules, and an
// exclusion decision, all against the dev deployment in NEXT_PUBLIC_CONVEX_URL.
// Usage: node --import tsx scripts/verify/unit7-convex.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api.js'
import { fixtureBothRun, fixtureRun } from '../../lib/export/fixture.ts'
import { fromStoredRun, orientationKey, toStoredRun } from '../../lib/persist/codec.ts'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)="?([^"#]*?)"?\s*(#.*)?$/.exec(line.trim())
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim()
  }
}
loadEnvLocal()

const url = process.env.NEXT_PUBLIC_CONVEX_URL
if (!url) {
  console.error('FAILED: NEXT_PUBLIC_CONVEX_URL is not set')
  process.exit(1)
}
const client = new ConvexHttpClient(url)

const failures = []
function check(ok, label, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`)
  if (!ok) failures.push(label)
}

const SLUG = 'verify-210king'
const started = Date.now()
execFileSync('npx', ['convex', 'run', 'admin:resetProject', JSON.stringify({ slug: SLUG })], { stdio: 'ignore' })

const projectId = await client.mutation(api.projects.upsert, {
  slug: SLUG,
  modelUrn: fixtureRun.snapshot.modelUrn,
  modelName: '210_King_Arch.rvt',
  viewableName: fixtureRun.snapshot.viewableName,
  viewableGuid: fixtureRun.snapshot.viewableGuid,
  northAngleDeg: fixtureRun.snapshot.north.angleDeg,
  northSource: fixtureRun.snapshot.north.source,
})
const again = await client.mutation(api.projects.upsert, {
  slug: SLUG,
  modelUrn: fixtureRun.snapshot.modelUrn,
  modelName: '210_King_Arch.rvt',
  viewableName: fixtureRun.snapshot.viewableName,
  viewableGuid: fixtureRun.snapshot.viewableGuid,
  northAngleDeg: 12.5,
  northSource: 'user',
})
check(again === projectId, 'projects.upsert returns the same id for the same slug', { projectId })
const project = await client.query(api.projects.getBySlug, { slug: SLUG })
check(project?.northAngleDeg === 12.5 && project.northSource === 'user', 'projects.getBySlug reflects the upsert')

check(
  isDeepStrictEqual(project?.schemes, ['EDGE']) && isDeepStrictEqual(project?.inputs, {}),
  'a reset project measures EDGE only and has no inputs',
  project && { schemes: project.schemes, inputs: project.inputs },
)
await client.mutation(api.projects.setSchemes, { projectId, schemes: ['CASA', 'EDGE', 'CASA'] })
await client.mutation(api.projects.setInputs, {
  projectId,
  inputs: { typology: 'vis', climateZone: 'templado', municipality: ' 05001 ', roadGradeM: 1502.4, floodReturnYears: 50 },
})
const scoped = await client.query(api.projects.getBySlug, { slug: SLUG })
check(isDeepStrictEqual(scoped?.schemes, ['EDGE', 'CASA']), 'projects.setSchemes stores scheme order without repeats', scoped?.schemes)
check(
  isDeepStrictEqual(scoped?.inputs, { typology: 'vis', climateZone: 'templado', municipality: '05001', roadGradeM: 1502.4, floodReturnYears: 50 }),
  'projects.setInputs stores the inputs, municipality trimmed',
  scoped?.inputs,
)
const rejects = async (fn) => fn().then(() => false, () => true)
check(await rejects(() => client.mutation(api.projects.setSchemes, { projectId, schemes: [] })), 'projects.setSchemes refuses an empty selection')
check(
  await rejects(() => client.mutation(api.projects.setInputs, { projectId, inputs: { projectAreaM2: -5 } })),
  'projects.setInputs refuses a negative project area',
)
await client.mutation(api.projects.setInputs, { projectId, inputs: { climateZone: 'frio' } })
check(isDeepStrictEqual((await client.query(api.projects.getBySlug, { slug: SLUG }))?.inputs, { climateZone: 'frio' }), 'projects.setInputs replaces, a cleared field is gone')
await client.mutation(api.projects.upsert, {
  slug: SLUG,
  modelUrn: fixtureRun.snapshot.modelUrn,
  modelName: '210_King_Arch.rvt',
  viewableName: fixtureRun.snapshot.viewableName,
  viewableGuid: fixtureRun.snapshot.viewableGuid,
  northAngleDeg: 12.5,
  northSource: 'user',
})
check(isDeepStrictEqual((await client.query(api.projects.getBySlug, { slug: SLUG }))?.schemes, ['EDGE', 'CASA']), 'projects.upsert keeps the schemes the person chose')

await client.mutation(api.projects.setNorth, { projectId, northAngleDeg: 370, northSource: 'user' })
const northed = await client.query(api.projects.getBySlug, { slug: SLUG })
check(northed?.northAngleDeg === 10, 'projects.setNorth normalises to 0..360', northed?.northAngleDeg)

const run = { ...fixtureBothRun, runId: `verify-${Date.now()}`, computedAt: new Date().toISOString() }
const bundle = toStoredRun(run)
const runDocId = await client.mutation(api.runs.save, { projectId, ...bundle })
check(typeof runDocId === 'string', 'runs.save returns a run id', runDocId)
check(JSON.stringify(bundle.run).length < 1_000_000, 'stored run document is under 1 MB', JSON.stringify(bundle.run).length)

const typeKey = 'Mass:Context Massing'
await client.mutation(api.classifications.confirm, { projectId, typeKey, role: 'massing' })
await client.mutation(api.classifications.confirm, { projectId, typeKey, role: 'shading' })
await client.mutation(api.classifications.saveMany, {
  projectId,
  rows: [{ typeKey, role: 'other', source: 'model', confidence: 0.6, reason: 'late model guess' }],
})
const classifications = await client.query(api.classifications.listByProject, { projectId })
const rows = classifications.filter((c) => c.typeKey === typeKey)
check(rows.length === 1, 'one classification row per type after two confirms and a saveMany', rows.length)
check(
  rows[0]?.role === 'shading' && rows[0]?.source === 'user' && rows[0]?.confidence === 1,
  'the second user confirmation wins and a model row does not overwrite it',
  rows[0] && { role: rows[0].role, source: rows[0].source },
)
check(
  classifications.length === fixtureRun.classifications.length,
  'runs.save folded the fixture classifications into the project',
  classifications.length,
)

const exclusionId = 'excl-massing'
await client.mutation(api.exclusions.decide, { projectId, id: exclusionId, status: 'rejected' })
await client.mutation(api.exclusions.saveProposed, {
  projectId,
  rows: [{ id: exclusionId, dbIds: [1], reason: 'massing', source: 'agent', status: 'proposed' }],
})
const exclusions = await client.query(api.exclusions.listByProject, { projectId })
const decided = exclusions.find((e) => e.id === exclusionId)
check(decided?.status === 'rejected', 'exclusions.decide(status=rejected) sets rejected', decided?.status)
check(decided?.dbIds.length === 12, 'saveProposed does not overwrite a decided exclusion', decided?.dbIds.length)
await client.mutation(api.exclusions.decide, { projectId, id: exclusionId, status: 'proposed' })
const undone = (await client.query(api.exclusions.listByProject, { projectId })).find((e) => e.id === exclusionId)
check(undone?.status === 'proposed', 'exclusions.decide(status=proposed) undoes the rejection', undone?.status)

await client.mutation(api.classifications.unconfirm, { projectId, typeKey })
await client.mutation(api.classifications.saveMany, {
  projectId,
  rows: [{ typeKey, role: 'other', source: 'model', confidence: 0.6, reason: 'model answer after undo' }],
})
const unconfirmed = (await client.query(api.classifications.listByProject, { projectId })).filter((c) => c.typeKey === typeKey)
check(
  unconfirmed.length === 1 && unconfirmed[0].source === 'model',
  'classifications.unconfirm deletes the user row, so the model answer takes its place',
  unconfirmed.map((c) => c.source),
)

const latest = await client.query(api.runs.latest, { projectId })
check(latest?.run._id === runDocId, 'runs.latest returns the run just saved')
const rebuilt = fromStoredRun(latest.run, latest.elements, latest.classifications, latest.exclusions)
const eem01 = rebuilt.measures.find((m) => m.code === 'EEM01')
const fixtureEem01 = fixtureRun.measures.find((m) => m.code === 'EEM01')
check(
  JSON.stringify(eem01?.orientations?.map((o) => [o.orientation, o.wallDbIds, o.glazingDbIds])) ===
    JSON.stringify(fixtureEem01.orientations.map((o) => [o.orientation, o.wallDbIds, o.glazingDbIds])),
  'orientation dbIds round-trip through runElements',
)
check(
  isDeepStrictEqual(rebuilt.measures, fixtureBothRun.measures),
  'EDGE and CASA measures, gaps, inputs and blockers round-trip (key order ignored)',
)
check(
  isDeepStrictEqual([rebuilt.schemes, rebuilt.guides, rebuilt.inputs], [fixtureBothRun.schemes, fixtureBothRun.guides, fixtureBothRun.inputs]),
  'the run keeps its schemes, guide versions and project inputs',
)
const northIds = await client.query(api.runs.elementIds, { runId: runDocId, key: orientationKey('EEM01', 'N', 'wall') })
check(JSON.stringify(northIds) === JSON.stringify([1201, 1202, 1203, 1204]), 'runs.elementIds returns one key', northIds)

const history = await client.query(api.runs.list, { projectId })
check(history.length >= 1 && history.length <= 10 && history[0]._id === runDocId, 'runs.list is newest first, at most 10', history.length)

const packId = await client.mutation(api.packs.save, {
  runId: runDocId,
  url: 'https://example.invalid/packs/verify.zip',
  size: 1234,
  manifest: { runId: run.runId },
})
const pack = await client.query(api.packs.latestForRun, { runId: runDocId })
check(pack?._id === packId && pack.projectId === projectId, 'packs.latestForRun returns the saved pack')

console.log(`\n${Date.now() - started} ms against ${url}`)
if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.join('; ')}`)
  process.exit(1)
}
console.log('\nVERIFIED')
