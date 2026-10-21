import type { Classification, Element, ElementRole } from '@/lib/edge/types'
import { paramValue } from './types-index'

/** What a rule can look at. Every field is the sample element's text, or empty. */
export type Subject = {
  category: string
  family: string
  typeName: string
  typeKey: string
  /** Revit wall "Function" parameter: Exterior, Interior, Foundation, Retaining, Soffit, Core-shaft. Spanish Revit writes Exterior and Interior too. */
  function: string
  /** Category of the host element, for windows cut into roofs. */
  hostCategory: string
}

export type Rule = {
  when: Partial<Record<keyof Subject, RegExp>> & { param?: [name: string, value: RegExp] }
  role: ElementRole
  reason: string
}

const NAME_FIELDS = ['family', 'typeName', 'typeKey'] as const

// Spanish names sit beside the English ones: Colombian models are often authored in Spanish Revit.
const GLAZED = /glaz|glass|window|vision|acristalad|vidrio|vidriad|cristal|ventana/i
/** Revit's "Empty" system panel, and TORRE A's "aire" panels: openings with no infill, neither glazing nor opaque façade. */
const EMPTY_PANEL = /\baire\b|empty|vac[ií]o/i
const SOLID = /spandrel|solid|metal|stone|wood|alumin|panel\b(?!.*glass)/i
const SHADING = /shade|sun|louv|fin\b|brise|overhang|persiana|celos[ií]a|parasol/i
const SKYLIGHT = /skylight|rooflight|claraboya|tragaluz/i
const CURTAIN_FAMILY = /curtain|muro cortina|system panel|panel de sistema|CW_/i
const MASSING = /massing|masing|\bmasa/i
const PARAPET = /parapet|antepecho|pretil/i

const ENVELOPE_CATEGORIES = /Walls|Curtain Panels|Windows|Generic Models|Roofs|Floors|Doors|Rooms|Mass$/
// Categories outside the envelope settle as "other" by rule. Envelope types that match no rule stay leftovers for the decision model, so the regex is a negative lookahead rather than a catch-all.
const NOT_ENVELOPE = new RegExp(`^(?!.*(?:${ENVELOPE_CATEGORIES.source}))`)

/** Building services and site categories, each one role. */
const CATEGORY_ROLES: [category: RegExp, role: ElementRole, reason: string][] = [
  [/Plumbing Fixtures/, 'plumbing-fixture', 'Revit Plumbing Fixtures category'],
  [/Lighting Fixtures/, 'lighting-fixture', 'Revit Lighting Fixtures category'],
  [/Mechanical Equipment|Electrical Equipment|Specialty Equipment|Electrical Fixtures/, 'equipment', 'Revit equipment or electrical fixture category'],
  [/Parking/, 'parking', 'Revit Parking category'],
  [/Planting/, 'planting', 'Revit Planting category'],
  [/Areas$/, 'area', 'Revit Areas category'],
  [/Pipes$|Piping Systems|Pipe Accessories/, 'pipe', 'Revit piping category'],
]

const named = (pattern: RegExp, rest: Rule['when'], role: ElementRole, reason: string): Rule[] =>
  NAME_FIELDS.map((field) => ({ when: { ...rest, [field]: pattern }, role, reason }))

export const RULES: Rule[] = [
  ...named(MASSING, { category: /Walls|Mass$/ }, 'massing', 'name matches "massing"'),
  { when: { category: /Mass$/ }, role: 'massing', reason: 'Revit Mass category' },
  ...named(PARAPET, { category: /Walls/ }, 'parapet', 'name matches "parapet"'),
  { when: { category: /Curtain Wall Mullions/ }, role: 'other', reason: 'mullion, its area is counted inside the panel rough opening' },
  ...named(/mullion/i, { category: /Walls/ }, 'other', 'mullion, its area is counted inside the panel rough opening'),
  ...named(EMPTY_PANEL, { category: /Curtain Panels/ }, 'other', 'empty panel'),
  ...named(EMPTY_PANEL, { category: /Walls/, family: CURTAIN_FAMILY }, 'other', 'empty panel'),
  ...named(GLAZED, { category: /Curtain Panels/ }, 'curtain-glazed', 'curtain panel name matches glazing'),
  ...named(GLAZED, { category: /Walls/, family: CURTAIN_FAMILY }, 'curtain-glazed', 'curtain panel name matches glazing'),
  ...named(SOLID, { category: /Curtain Panels/ }, 'curtain-solid', 'curtain panel name matches an opaque panel'),
  ...named(SOLID, { category: /Walls/, family: CURTAIN_FAMILY }, 'curtain-solid', 'curtain panel name matches an opaque panel'),
  { when: { category: /Walls/, function: /^Exterior$/i }, role: 'exterior-wall', reason: 'Function = Exterior' },
  { when: { category: /Walls/, function: /^(Interior|Core-?shaft|Soffit)$/i }, role: 'interior-wall', reason: 'Function = Interior, Core-shaft or Soffit' },
  { when: { category: /Walls/, function: /^(Foundation|Retaining)$/i }, role: 'exterior-wall', reason: 'Function = Foundation or Retaining, below grade is decided by level' },
  ...named(SKYLIGHT, { category: /Windows/ }, 'skylight', 'name matches "skylight"'),
  { when: { category: /Windows/, hostCategory: /Roofs/ }, role: 'skylight', reason: 'window hosted in a roof' },
  { when: { category: /Windows/ }, role: 'window', reason: 'Revit Windows category' },
  { when: { category: /Doors/ }, role: 'door', reason: 'Revit Doors category' },
  { when: { category: /Roofs/ }, role: 'roof', reason: 'Revit Roofs category' },
  { when: { category: /Floors/ }, role: 'floor', reason: 'Revit Floors category' },
  { when: { category: /Rooms/ }, role: 'room', reason: 'Revit Rooms category' },
  ...named(SHADING, { category: /Generic Models/ }, 'shading', 'generic model name matches a shading device'),
  ...CATEGORY_ROLES.map(([category, role, reason]): Rule => ({ when: { category }, role, reason })),
  { when: { category: NOT_ENVELOPE }, role: 'other', reason: 'category outside the building envelope' },
]

export function subjectOf(element: Element, byDbId?: Map<number, Element>): Subject {
  const host = element.hostDbId === undefined ? undefined : byDbId?.get(element.hostDbId)
  return {
    category: element.category,
    family: element.family ?? '',
    typeName: element.typeName ?? '',
    typeKey: element.typeKey,
    function: String(paramValue(element.params, 'Function') ?? ''),
    hostCategory: host?.category ?? '',
  }
}

export function matches(rule: Rule, subject: Subject, element: Element): boolean {
  const { param, ...fields } = rule.when
  for (const [field, pattern] of Object.entries(fields) as [keyof Subject, RegExp][]) {
    if (!pattern.test(subject[field])) return false
  }
  if (param) {
    const value = paramValue(element.params, param[0])
    if (value === undefined || value === null || !param[1].test(String(value))) return false
  }
  return true
}

/** First matching rule wins. Null means the type is a leftover for the decision model or the person. */
export function classifyByRule(
  elementsOfType: Element[],
  byDbId?: Map<number, Element>,
): Classification | null {
  const sample = elementsOfType[0]
  if (!sample) return null
  const subject = subjectOf(sample, byDbId)
  const rule = RULES.find((candidate) => matches(candidate, subject, sample))
  if (!rule) return null
  return { typeKey: sample.typeKey, role: rule.role, source: 'rule', confidence: 1, reason: rule.reason }
}
