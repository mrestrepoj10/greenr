import { describe, expect, test } from 'vitest'
import { preferredViewable } from './catalog'
import type { Viewable } from './types'

const view = (name: string, isMasterView = false, role: Viewable['role'] = '3d'): Viewable => ({ guid: name, name, role, isMasterView })

describe('preferredViewable', () => {
  test('TORRE A: the "Nueva construcción" master view wins over the "Existente" master view listed first', () => {
    const viewables = [view('{3D}'), view('Existente', true), view('Nueva construcción', true)]
    expect(preferredViewable(viewables)?.name).toBe('Nueva construcción')
  })

  test('210 King: "New Construction" is still the pick', () => {
    expect(preferredViewable([view('{3D}'), view('New Construction', true)])?.name).toBe('New Construction')
  })

  test.each(['NUEVA CONSTRUCCION', 'nueva construccíon', 'Neubau', 'Nouvelle construction', 'Nova construção'])(
    '%s matches without case or accents',
    (name) => {
      expect(preferredViewable([view('Existente', true), view(name, true)])?.name).toBe(name)
    },
  )

  test('a new-construction name beats a master view with another name', () => {
    expect(preferredViewable([view('Fase 1', true), view('Nueva construcción')])?.name).toBe('Nueva construcción')
  })

  test('with no new-construction name, the last master view (the latest phase) beats {3D}', () => {
    expect(preferredViewable([view('{3D}'), view('Fase 1', true), view('Fase 2', true)])?.name).toBe('Fase 2')
  })

  test('without master views, {3D} and then the first 3D viewable', () => {
    expect(preferredViewable([view('Vista A'), view('{3D}')])?.name).toBe('{3D}')
    expect(preferredViewable([view('Plano', false, '2d'), view('Vista A')])?.name).toBe('Vista A')
    expect(preferredViewable([view('Nueva construcción', true, '2d')])).toBeUndefined()
  })
})
