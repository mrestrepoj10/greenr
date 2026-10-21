const whole = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 0 })
const tenth = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })

export function formatArea(m2: number): string {
  return whole.format(m2)
}

export function formatRatio(ratio: number): string {
  return percent.format(ratio)
}

export function formatValue(value: number | string | null): string {
  if (value === null) return 'not set'
  if (typeof value === 'string') return value
  return Number.isInteger(value) ? whole.format(value) : tenth.format(value)
}

export function formatDegrees(deg: number): string {
  return `${tenth.format(deg)}°`
}

export function roleTitle(typeKey: string): string {
  return typeKey.replace(/\s*:\s*/, ' · ')
}
