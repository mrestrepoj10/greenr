import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { classifySnapshot } from '@/lib/classify'
import { analyzeEnvelope } from './envelope'
import { missingGlazingData } from './measures/eem09'
import { positive } from './params'
import { isBedroomName, isOutdoorRoomName, isWetRoomName, roomName } from './rooms'
import type { Element, Snapshot } from './types'

/** Captured by `CAPTURE=1 node scripts/verify/c2-snapshot.mjs`, gzipped because the JSON is 22 MB. */
const load = (name: string): Snapshot =>
  JSON.parse(gunzipSync(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url))).toString('utf8')) as Snapshot

describe('TORRE A ARQ v20 snapshot', () => {
  const snapshot = load('torre-a.json.gz')
  const roles = new Map(classifySnapshot(snapshot).merged.map((c) => [c.typeKey, c.role]))
  const of = (pattern: RegExp) => snapshot.elements.filter((e) => pattern.test(e.typeKey))
  const rooms = snapshot.elements.filter((e) => e.category === 'Revit Rooms')

  test('is the new-construction phase, with its 30 levels', () => {
    expect(snapshot.viewableName).toBe('Nueva construcción')
    expect(snapshot.levels).toHaveLength(30)
  })

  test('all 73 rooms are unplaced and flagged, so a measure can say so instead of reporting zeros', () => {
    expect(rooms).toHaveLength(73)
    expect(rooms.filter((r) => r.unplaced)).toHaveLength(73)
  })

  test('room names: 31 bedrooms, 17 wet rooms, 3 balconies', () => {
    const names = rooms.map(roomName)
    expect(names.filter(isBedroomName)).toHaveLength(31)
    expect(names.filter(isWetRoomName)).toHaveLength(17)
    expect(names.filter((n) => isOutdoorRoomName(n))).toEqual(['Balcon', 'Balcon', 'Balcon'])
  })

  test('the 603 "aire" panels are empty, and the 13 Acristalado panels are glazing whose U is read under its new name', () => {
    expect(of(/Panel de sistema \/ aire$/).map((e) => roles.get(e.typeKey))).toEqual(Array(603).fill('other'))
    const glazed = of(/Panel de sistema \/ Acristalado$/)
    expect(glazed.map((e) => roles.get(e.typeKey))).toEqual(Array(13).fill('curtain-glazed'))
    expect(positive(glazed[0].params, 'Heat Transfer Coefficient (U)')).toBe(6.7069)
    expect(missingGlazingData(glazed[0].params)).toEqual([])
  })

  describe('envelope', () => {
    const env = analyzeEnvelope(snapshot)
    const area = (es: Element[]) => es.reduce((s, e) => s + (e.area ?? 0), 0)

    test('keeps the Exterior render, paint and tile skins out of the façade: at least 95% of their area', () => {
      const skins = snapshot.elements.filter(
        (e) => e.params.Function === 'Exterior' && /pintura|revoque|guarda ?escoba|enchape|graniplast|nivelaci|estuco|pa[ñn]ete/i.test(e.typeKey),
      )
      expect(skins.length).toBeGreaterThan(7000)
      expect(area(skins.filter((e) => env.finishLayers.has(e.dbId))) / area(skins)).toBeGreaterThan(0.95)
    })

    test('no wall 5 cm or thicker is a finish layer, and every layer maps to a wall that is probed', () => {
      const byDbId = new Map(snapshot.elements.map((e) => [e.dbId, e]))
      for (const [skin, wall] of env.finishLayers) {
        expect(byDbId.get(skin)!.facade!.thickness).toBeLessThan(0.05)
        expect(env.walls.has(wall)).toBe(true)
      }
    })

    test('openings keep their hosts, the Interior sliding glass doors included', () => {
      const openings = [...env.openings.values()]
      const hosted = (pattern: RegExp) => {
        const list = openings.filter((o) => pattern.test(o.element.category) && o.kind !== 'panel')
        return [list.filter((o) => o.hostDbId !== null).length, list.length]
      }
      expect(hosted(/Windows/)).toEqual([266, 267])
      expect(hosted(/Doors/)).toEqual([177, 183])
      const sliding = openings.filter((o) => /Doors/.test(o.element.category) && /corrediza/i.test(o.element.typeKey))
      expect(sliding.filter((o) => o.element.params.Function === 'Interior')).toHaveLength(137)
      expect(sliding.filter((o) => o.hostDbId !== null)).toHaveLength(145)
    })
  })
})

describe('TORRE A HS plumbing snapshot', () => {
  const snapshot = load('torre-a-hs.json.gz')
  const roles = new Map(classifySnapshot(snapshot).merged.map((c) => [c.typeKey, c.role]))
  const roleCount = (role: string) => snapshot.elements.filter((e) => roles.get(e.typeKey) === role).length

  test('177 shower mixers are plumbing fixtures; pipes and the 105 water meters are piping', () => {
    expect(roleCount('plumbing-fixture')).toBe(177)
    expect(new Set(snapshot.elements.filter((e) => e.category === 'Revit Plumbing Fixtures').map((e) => e.typeKey))).toEqual(
      new Set(['MezcladorDucha / MezcladorDucha']),
    )
    expect(snapshot.elements.filter((e) => /Medidor de agua potable/.test(e.typeKey))).toHaveLength(105)
    expect(roleCount('pipe')).toBe(snapshot.elements.length - 177)
    expect(snapshot.levels).toHaveLength(30)
  })
})
