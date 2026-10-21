import type { Bbox, Classification, Element, ElementRole, FacadeGeometry, FacadeKind, Snapshot } from '../types'

const rect = (x0: number, y0: number, x1: number, y1: number) => [x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1]

export function facadeAlong(
  kind: FacadeKind,
  [x0, y0]: [number, number],
  [x1, y1]: [number, number],
  zmin: number,
  zmax: number,
  thickness: number,
): { facade: FacadeGeometry; bbox: Bbox } {
  const len = Math.hypot(x1 - x0, y1 - y0)
  let n: [number, number] = [-(y1 - y0) / len, (x1 - x0) / len]
  if (Math.atan2(n[1], n[0]) < -1e-9 || Math.atan2(n[1], n[0]) >= Math.PI - 1e-9) n = [-n[0], -n[1]]
  const u: [number, number] = [-n[1], n[0]]
  const a = x0 * u[0] + y0 * u[1]
  const b = x1 * u[0] + y1 * u[1]
  const h = thickness / 2
  return {
    facade: {
      kind,
      axisDeg: ((Math.atan2(n[1], n[0]) * 180) / Math.PI + 180) % 180,
      n,
      u,
      sMid: x0 * n[0] + y0 * n[1],
      thickness,
      umin: Math.min(a, b),
      umax: Math.max(a, b),
      zmin,
      zmax,
      uc: (a + b) / 2,
      verticalArea: 2 * len * (zmax - zmin),
    },
    bbox: [
      Math.min(x0, x1) - Math.abs(n[0]) * h,
      Math.min(y0, y1) - Math.abs(n[1]) * h,
      zmin,
      Math.max(x0, x1) + Math.abs(n[0]) * h,
      Math.max(y0, y1) + Math.abs(n[1]) * h,
      zmax,
    ],
  }
}

let nextId = 1

export function element(category: string, typeKey: string, fields: Partial<Element> = {}): Element {
  const [family, typeName] = typeKey.split(' / ')
  return { dbId: nextId++, typeKey, category, family, typeName, params: {}, ...fields }
}

export function room(name: string, level: string, [x0, y0, x1, y1]: [number, number, number, number], zmin: number, zmax: number): Element {
  return element('Revit Rooms', 'Room / Room', {
    level,
    area: (x1 - x0) * (y1 - y0),
    bbox: [x0, y0, zmin, x1, y1, zmax],
    params: { Name: name },
    footprint: { triangles: rect(x0, y0, x1, y1), zmin, zmax, baseOffset: 0 },
  })
}

export function snapshotOf(elements: Element[], levels: Snapshot['levels'], northAngleDeg = 0): Snapshot {
  return {
    modelUrn: 'urn:synthetic',
    viewableGuid: 'synthetic',
    viewableName: 'synthetic',
    units: 'm',
    levels,
    elements,
    north: { source: northAngleDeg ? 'user' : 'project', angleDeg: northAngleDeg },
    takenAt: '2026-10-21T00:00:00.000Z',
  }
}

export function classify(roles: Record<string, ElementRole>): Classification[] {
  return Object.entries(roles).map(([typeKey, role]) => ({ typeKey, role, source: 'rule', confidence: 1, reason: 'test' }))
}

export type BoxOptions = { wallTop?: number; northAngleDeg?: number; windowParams?: Element['params'] }

/** The partition is typed exterior on purpose: only the room probe can drop it. */
export function box({ wallTop = 7, northAngleDeg = 0, windowParams = {} }: BoxOptions = {}) {
  nextId = 1
  const wall = (kind: FacadeKind, a: [number, number], b: [number, number], typeKey: string, area: number) => {
    const g = facadeAlong(kind, a, b, 0, wallTop, 0.3)
    return element('Revit Walls', typeKey, { area, facade: g.facade, bbox: g.bbox })
  }
  const opening = (category: string, typeKey: string, a: [number, number], b: [number, number], z0: number, h: number, params = {}) => {
    const g = facadeAlong(category === 'Revit Doors' ? 'door' : 'window', a, b, z0, z0 + h, 0.1)
    return element(category, typeKey, { width: Math.hypot(b[0] - a[0], b[1] - a[1]), height: h, facade: g.facade, bbox: g.bbox, params })
  }
  const H = wallTop
  const south = wall('wall', [0, 0], [20, 0], 'Basic Wall / Ext', 20 * H - 3)
  const north = wall('wall', [0, 10], [20, 10], 'Basic Wall / Ext', 20 * H - 4)
  const east = wall('wall', [20, 0], [20, 10], 'Basic Wall / Ext', 10 * H - 2)
  const west = wall('curtain-wall', [0, 0], [0, 10], 'Curtain Wall / CW', 10 * H)
  const partition = wall('wall', [10, 0], [10, 10], 'Basic Wall / Ext', 10 * H)
  const southWindow = opening('Revit Windows', 'Window / W1', [4, 0], [6, 0], 1, 1.5, windowParams)
  const northWindow = opening('Revit Windows', 'Window / W2', [9, 10], [11, 10], 1, 2, windowParams)
  const eastDoor = opening('Revit Doors', 'Door / D1', [20, 4.5], [20, 5.5], 0, 2)
  const panel = (typeKey: string, area: number, y0: number, y1: number) => {
    const g = facadeAlong('panel', [0, y0], [0, y1], 0, H, 0.05)
    return element('Revit Curtain Panels', typeKey, { area, facade: g.facade, bbox: g.bbox, hostDbId: west.dbId })
  }
  const glazedPanel = panel('System Panel / Glazed', 40, 0, 6)
  const solidPanel = panel('System Panel / Solid', 30, 6, 10)
  const rooms = [
    room('Office A', 'L0', [0.15, 0.15, 9.85, 9.85], 0, 3.5),
    room('Office B', 'L0', [10.15, 0.15, 19.85, 9.85], 0, 3.5),
    room('Office C', 'L1', [0.15, 0.15, 9.85, 9.85], 3.5, 7),
    room('Office D', 'L1', [10.15, 0.15, 19.85, 9.85], 3.5, 7),
  ]
  const snapshot = snapshotOf(
    [south, north, east, west, partition, southWindow, northWindow, eastDoor, glazedPanel, solidPanel, ...rooms],
    [
      { name: 'L0', elevation: 0 },
      { name: 'L1', elevation: 3.5 },
    ],
    northAngleDeg,
  )
  const classifications = classify({
    'Basic Wall / Ext': 'exterior-wall',
    'Curtain Wall / CW': 'exterior-wall',
    'Window / W1': 'window',
    'Window / W2': 'window',
    'Door / D1': 'door',
    'System Panel / Glazed': 'curtain-glazed',
    'System Panel / Solid': 'curtain-solid',
    'Room / Room': 'room',
  })
  return { snapshot, classifications, ids: { south, north, east, west, partition, southWindow, northWindow, eastDoor, glazedPanel, solidPanel } }
}
