import type { Element } from './types'

export function param(params: Element['params'], name: string): string | number | null | undefined {
  if (name in params) return params[name]
  const suffix = `::${name}`
  for (const key of Object.keys(params)) if (key.endsWith(suffix)) return params[key]
  return undefined
}

/** A positive number, or null. EDGE treats a zero analytical value as unset: Revit writes 0 when thermal properties are schematic. */
export function positive(params: Element['params'], name: string): number | null {
  const value = param(params, name)
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

export function text(params: Element['params'], name: string): string | null {
  const value = param(params, name)
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s && s !== '<None>' && s !== 'None' ? s : null
}
