#!/usr/bin/env node
// Unit C3 check: the CASA measures over the 210 King fixture, printed as tables.
// Usage: pnpm exec tsx scripts/verify/c3-measures.mjs
import { readFileSync } from 'node:fs'
import { proposeExclusions } from '../../lib/edge/exclusions.ts'
import { MEASURES } from '../../lib/edge/measures/index.ts'
import { MEASURE_CODES } from '../../lib/edge/types.ts'
import { mscRows } from '../../lib/export/csv.ts'
import { computeRun } from '../../lib/edge/run.ts'

const fixture = (name) => JSON.parse(readFileSync(new URL(`../../lib/edge/__fixtures__/${name}`, import.meta.url), 'utf8'))
const snapshot = fixture('210king.json')
const classifications = fixture('210king.classifications.json')
const accepted = proposeExclusions(snapshot, classifications).map((e) => ({ ...e, status: 'accepted' }))
const inputs = { typology: 'vis', housingForm: 'multifamiliar', climateZone: 'templado', roadGradeM: 0, floodElevationM: 1, floodReturnYears: 100, inFloodplain: true, datumOffsetM: 0 }

const failures = []
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`)
  if (!ok) failures.push(message)
}
const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v))

const eem01 = MEASURES.EEM01.compute(snapshot, classifications, accepted, inputs)
const env = MEASURES['C-ENV'].compute(snapshot, classifications, accepted, inputs)
console.log('\n210 King, C-ENV 4 façades (confirmed exclusions, project north)')
console.table(env.orientations.map((o) => ({ facade: o.orientation, gross_m2: +o.wallAreaM2.toFixed(1), glazing_m2: +o.glazingAreaM2.toFixed(1), wwr_pct: +((o.wwr ?? 0) * 100).toFixed(1) })))
const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0)
const gross4 = sum(env.orientations, 'wallAreaM2')
const gross8 = sum(eem01.orientations, 'wallAreaM2')
check(Math.abs(gross4 - gross8) < 0.1, `N+E+S+W gross ${gross4.toFixed(1)} m² equals the EEM01 8-orientation gross ${gross8.toFixed(1)} m²`)
check(Math.abs(sum(env.orientations, 'glazingAreaM2') - sum(eem01.orientations, 'glazingAreaM2')) < 0.1, 'N+E+S+W glazing equals the EEM01 glazing')
console.table(env.inputs.filter((i) => !/ type: /.test(i.label)).map((i) => ({ label: i.label, value: fmt(i.value), unit: i.unit, source: i.source })))

const flood = MEASURES['C-FLOOD'].compute(snapshot, classifications, accepted, inputs)
console.log(`\n210 King, C-FLOOD with road grade ${inputs.roadGradeM} m, ${inputs.floodReturnYears}-year flood at ${inputs.floodElevationM} m, datum offset ${inputs.datumOffsetM} m`)
console.table(flood.inputs.map((i) => ({ label: i.label, value: fmt(i.value), unit: i.unit, source: i.source, elements: i.dbIds?.length ?? '' })))
check(flood.blockedBy === undefined, 'C-FLOOD is not blocked once the three elevations are typed')
const lowest = flood.inputs.find((i) => i.label.startsWith('Lowest habitable floor,')).value
const basement = snapshot.levels.find((l) => l.name === 'BLDG 1- BASEMENT FLR. FIN.').elevation
check(Math.abs(lowest - basement) < 0.01, `the lowest habitable floor (${lowest.toFixed(3)} m) is the BLDG 1 basement level (${basement} m), not the model z of -20 m`)
const bare = MEASURES['C-FLOOD'].compute(snapshot, classifications, accepted, {})
check(bare.state === 'blocked' && bare.blockedBy.length === 3, 'C-FLOOD without elevations is blocked on 3 inputs')

console.log('\n210 King, every CASA measure')
const results = MEASURE_CODES.CASA.map((code) => MEASURES[code].compute(snapshot, classifications, accepted, inputs))
console.table(
  results.map((r) => ({
    code: r.code,
    state: r.state,
    inputs: r.inputs.length,
    blocking: (r.blockedBy ?? []).map((b) => `${b.kind} ${b.input ?? b.parameter ?? b.elements ?? (b.count === undefined ? '' : `${b.count}/${b.total}`)}`.trim()).join('; '),
    gaps: r.gaps.length,
    flags: (r.flags ?? []).map((f) => f.id).join(' '),
    page: r.guide.page,
  })),
)
check(results.every((r) => r.guide.url.endsWith(`#page=${Number(r.guide.page) + 1}`)), 'every CASA guide link opens the printed page plus one')

const run = computeRun(snapshot, classifications, accepted, { schemes: ['CASA'], inputs }, undefined, 'verify')
console.log('\n210 King, casa-inputs.csv MS&C block')
console.table(mscRows(run).map(([field, label, value, unit, measure, source, , page]) => ({ field, label, value, unit, measure, source, page })))

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
