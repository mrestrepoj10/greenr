#!/usr/bin/env node
// Needs node 24, which strips TypeScript natively, so the script exercises lib/classify/decide.ts itself.
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = process.cwd()

// Node knows neither the "@/" alias nor extensionless TypeScript imports, so map both here instead of changing the source.
registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier
    if (target.startsWith('@/')) target = pathToFileURL(path.join(root, target.slice(2))).href
    if (target.startsWith('file:') || target.startsWith('.')) {
      const base = target.startsWith('file:') ? fileURLToPath(target) : path.join(path.dirname(fileURLToPath(context.parentURL)), target)
      if (!path.extname(base) && existsSync(`${base}.ts`)) target = pathToFileURL(`${base}.ts`).href
    }
    return nextResolve(target, context)
  },
})
const envFile = process.argv[2] ?? path.join(root, '.env.local')
try {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
} catch {
  console.error(`no env file at ${envFile}, relying on process.env`)
}

const { decideRoles } = await import(pathToFileURL(path.join(root, 'lib/classify/decide.ts')).href)

const items = [
  { typeKey: 'Basic Wall / Generic - 200mm', category: 'Revit Walls', family: 'Basic Wall', typeName: 'Generic - 200mm', params: { Function: '' } },
  { typeKey: 'System Panel / Glazed', category: 'Revit Curtain Panels', family: 'System Panel', typeName: 'Glazed', params: {} },
  { typeKey: 'Cornice / Cornice Type 1', category: 'Revit Generic Models', family: 'Cornice', typeName: 'Cornice Type 1', params: {} },
]

const started = Date.now()
const results = await decideRoles(items)
console.log(`${Date.now() - started} ms for ${items.length} items, key present: ${Boolean(process.env.AI_GATEWAY_API_KEY)}`)
for (const result of results) {
  console.log(`${result.typeKey.padEnd(32)} ${result.role.padEnd(16)} ${result.confidence.toFixed(3)}  ${result.reason}`)
}
process.exitCode = results.every((r) => r.confidence > 0) ? 0 : 1
