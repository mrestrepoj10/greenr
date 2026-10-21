import { positive } from '../params'
import type { Element } from '../types'
import { GLAZED_DOOR, openingAreaM2 } from './openings'
import { select, type Scope } from './scope'

/** Revit renamed the U parameter: TORRE A carries `Thermal Transmittance (U)`, 210 King `Heat Transfer Coefficient (U)`. */
export const U_PARAMS = ['Thermal Transmittance (U)', 'Heat Transfer Coefficient (U)'] as const
export const SHGC = 'Solar Heat Gain Coefficient'
export const VLT = 'Visual Light Transmittance'

/** Zero counts as missing, as in EEM09: Revit writes 0 when thermal properties are schematic. R stands in for U as its inverse. */
export function uValue(params: Element['params']): number | null {
  for (const name of U_PARAMS) {
    const u = positive(params, name)
    if (u !== null) return u
  }
  const r = positive(params, 'Thermal Resistance (R)')
  return r === null ? null : 1 / r
}

export type GlazingType = {
  typeKey: string
  dbIds: number[]
  areaM2: number
  u: number | null
  shgc: number | null
  vt: number | null
}

const glazedAreaM2 = (e: Element): number => (/Windows|Doors/.test(e.category) ? openingAreaM2(e) : (e.area ?? openingAreaM2(e)))

/** Windows, glazed curtain panels and glazed doors anywhere in the model, by type, largest area first. Not limited to the probed envelope, so it works with unplaced rooms. */
export function glazingTypes(scope: Scope): { types: GlazingType[]; involved: Element[] } {
  const glass = select(scope, ['window', 'curtain-glazed'], /Windows|Curtain Panels/)
  const doors = select(scope, ['door'], /Doors/)
  const glazedDoors = doors.used.filter((d) => GLAZED_DOOR.test(d.typeKey))
  const byType = new Map<string, Element[]>()
  for (const e of [...glass.used, ...glazedDoors]) byType.set(e.typeKey, [...(byType.get(e.typeKey) ?? []), e])
  const types = [...byType].map(([typeKey, elements]): GlazingType => {
    const params = elements[0].params
    return {
      typeKey,
      dbIds: elements.map((e) => e.dbId),
      areaM2: elements.reduce((s, e) => s + glazedAreaM2(e), 0),
      u: uValue(params),
      shgc: positive(params, SHGC),
      vt: positive(params, VLT),
    }
  })
  return {
    types: types.sort((a, b) => b.areaM2 - a.areaM2 || a.typeKey.localeCompare(b.typeKey)),
    involved: [...glass.involved, ...doors.involved.filter((d) => GLAZED_DOOR.test(d.typeKey))],
  }
}

/** Area-weighted over the types that carry the value; null when none does. */
export function areaWeighted<T extends { areaM2: number }>(items: readonly T[], value: (item: T) => number | null): number | null {
  let sum = 0
  let area = 0
  for (const item of items) {
    const v = value(item)
    if (v === null || item.areaM2 <= 0) continue
    sum += v * item.areaM2
    area += item.areaM2
  }
  return area > 0 ? sum / area : null
}
