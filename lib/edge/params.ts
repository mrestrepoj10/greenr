import type { Element } from './types'

/** Revit renamed some built-ins between versions: TORRE A writes "Thermal Transmittance (U)" where 210 King writes "Heat Transfer Coefficient (U)". */
const ALIASES: Record<string, readonly string[]> = {
  'Heat Transfer Coefficient (U)': ['Thermal Transmittance (U)'],
  'Thermal Transmittance (U)': ['Heat Transfer Coefficient (U)'],
}

const namesOf = (name: string): readonly string[] => [name, ...(ALIASES[name] ?? [])]

function lookup(params: Element['params'], name: string): string | number | null | undefined {
  if (name in params) return params[name]
  const suffix = `::${name}`
  for (const key of Object.keys(params)) if (key.endsWith(suffix)) return params[key]
  return undefined
}

export function param(params: Element['params'], name: string): string | number | null | undefined {
  for (const n of namesOf(name)) {
    const value = lookup(params, n)
    if (value !== undefined) return value
  }
  return undefined
}

/** A positive number, or null. EDGE treats a zero analytical value as unset: Revit writes 0 when thermal properties are schematic. */
export function positive(params: Element['params'], name: string): number | null {
  for (const n of namesOf(name)) {
    const value = lookup(params, n)
    const x = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
    if (Number.isFinite(x) && x > 0) return x
  }
  return null
}

export function text(params: Element['params'], name: string): string | null {
  const value = param(params, name)
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s && s !== '<None>' && s !== 'None' ? s : null
}
