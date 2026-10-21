import type { Element } from '@/lib/edge/types'

/** Every element of one type, the unit a person confirms. */
export type TypeGroup = {
  typeKey: string
  category: string
  sample: Element
  dbIds: number[]
}

export function groupByType(elements: Element[]): Map<string, TypeGroup> {
  const groups = new Map<string, TypeGroup>()
  for (const element of elements) {
    const group = groups.get(element.typeKey)
    if (group) {
      group.dbIds.push(element.dbId)
    } else {
      groups.set(element.typeKey, {
        typeKey: element.typeKey,
        category: element.category,
        sample: element,
        dbIds: [element.dbId],
      })
    }
  }
  return groups
}

export function indexByDbId(elements: Element[]): Map<number, Element> {
  return new Map(elements.map((element) => [element.dbId, element]))
}

/** Reads a Revit parameter by its display name, with or without a "Group::" prefix. */
export function paramValue(
  params: Element['params'],
  name: string,
): string | number | null | undefined {
  if (name in params) return params[name]
  const suffix = `::${name}`
  for (const key of Object.keys(params)) {
    if (key.endsWith(suffix)) return params[key]
  }
  return undefined
}
