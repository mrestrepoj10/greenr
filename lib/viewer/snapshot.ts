import { SRI_PARAMS } from '@/lib/edge/measures/eem02'
import { GLAZING_PARAMS } from '@/lib/edge/measures/eem09'
import type { Element, FacadeKind, Level, Snapshot, Units } from '@/lib/edge/types'
import { createGeometryReader, facadeOf, footprintOf, type ViewerModelGeometry } from './geometry'

export type ReadSnapshotOptions = {
  /** True north in degrees clockwise from project north, when the person supplies it. */
  northAngleDeg?: number
}

type Role = 'wall' | 'panel' | 'window' | 'door' | 'roof' | 'floor' | 'room' | 'level' | 'base-point' | 'other'

const CATEGORIES: Record<string, Role> = {
  'Revit Walls': 'wall',
  'Revit Curtain Panels': 'panel',
  'Revit Windows': 'window',
  'Revit Doors': 'door',
  'Revit Roofs': 'roof',
  'Revit Floors': 'floor',
  'Revit Rooms': 'room',
  'Revit Level': 'level',
  'Revit Project Base Point': 'base-point',
  'Revit Generic Models': 'other',
  'Revit Mass': 'other',
}

const LENGTH_PARAMS = ['Length', 'Width', 'Height', 'Rough Width', 'Rough Height', 'Base Offset', 'Elevation']
const AREA_PARAMS = ['Area']
const KEPT_PARAMS = ['Function', 'Name', 'Rough Width', 'Rough Height', ...Object.values(GLAZING_PARAMS), ...SRI_PARAMS]
const PROPS = [
  ...new Set([
    'Type Name',
    'Level',
    'Base Constraint',
    'Phase Demolished',
    'Area',
    'Length',
    'Width',
    'Height',
    'Base Offset',
    'Elevation',
    'Angle to True North',
    ...KEPT_PARAMS,
  ]),
]

/** Forge unit ids to the factor that turns them into SI: metres, m², W/m²K, m²K/W. Version suffixes are stripped. */
const UNIT_FACTORS: Record<string, number> = {
  feet: 0.3048,
  feetFractionalInches: 0.3048,
  inches: 0.0254,
  fractionalInches: 0.0254,
  meters: 1,
  metersCentimeters: 1,
  decimeters: 0.1,
  centimeters: 0.01,
  millimeters: 0.001,
  squareFeet: 0.09290304,
  squareInches: 0.00064516,
  squareMeters: 1,
  squareCentimeters: 1e-4,
  squareMillimeters: 1e-6,
  britishThermalUnitsPerHourSquareFootDegreeFahrenheit: 5.678263,
  wattsPerSquareMeterKelvin: 1,
  hourSquareFootDegreesFahrenheitPerBritishThermalUnit: 0.1761102,
  squareMeterKelvinsPerWatt: 1,
  degrees: 1,
}

/**
 * Runs inside the property database worker, so it travels as source text: a string keeps bundlers from rewriting it
 * with helpers the worker cannot see.
 */
const PROPERTY_SCAN = `function (pdb, ud) {
  var catAttr = -1, typeAttr = -1, nameAttr = -1, keep = {}, factor = {};
  pdb.enumAttributes(function (i, d) {
    if (d.category === '__category__' && d.name === 'Category') catAttr = i;
    else if (d.category === '__instanceof__') typeAttr = i;
    else if (d.category === '__name__') nameAttr = i;
    else if ((!d.category || d.category.indexOf('__') !== 0) && ud.props.indexOf(d.name) >= 0) {
      keep[i] = d.name;
      var unit = d.dataTypeContext ? String(d.dataTypeContext).replace(/^autodesk\\.unit\\.unit:/, '').replace(/-[0-9.]+$/, '') : '';
      factor[i] = unit && ud.units[unit] !== undefined ? ud.units[unit]
        : ud.lengths.indexOf(d.name) >= 0 ? ud.scale
        : ud.areas.indexOf(d.name) >= 0 ? ud.scale * ud.scale : 1;
    }
  });
  function read(id) {
    var o = { p: {} };
    pdb.enumObjectProperties(id, function (a, v) {
      if (a === catAttr) o.cat = pdb.getAttrValue(a, v);
      else if (a === typeAttr) o.typeId = pdb.getAttrValue(a, v);
      else if (a === nameAttr) o.name = pdb.getAttrValue(a, v);
      else if (keep[a] !== undefined && o.p[keep[a]] === undefined) {
        var value = pdb.getAttrValue(a, v);
        o.p[keep[a]] = typeof value === 'number' ? value * factor[a] : value;
      }
    });
    return o;
  }
  var out = [];
  pdb.enumObjects(function (id) {
    var o = read(id);
    if (!ud.cats[o.cat]) return;
    var typed = false;
    if (o.typeId) {
      typed = true;
      var t = read(o.typeId);
      for (var k in t.p) if (o.p[k] === undefined) o.p[k] = t.p[k];
    }
    out.push({ dbId: id, category: o.cat, name: o.name, typed: typed, p: o.p });
  });
  return out;
}`

type Row = { dbId: number; category: string; name?: string; typed: boolean; p: Record<string, string | number | null> }

type ViewerModel = ViewerModelGeometry & {
  getUnitString(): string
  getUnitScale(): number
  getPropertyDb(): { executeUserFunction(code: string, userData: unknown): Promise<unknown> }
  getDocumentNode(): { name(): string; guid(): string; getRootNode(): { urn(): string } } | null
  getData(): { urn?: string }
}

const IMPERIAL = /ft|in/i
/** 0.05 ft: a room's floor faces lie within this of its lowest point. */
const ROOM_FLOOR_TOL_M = 0.01524

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined)

export async function readSnapshot(viewer: Autodesk.Viewing.Viewer3D, opts: ReadSnapshotOptions = {}): Promise<Snapshot> {
  const t0 = performance.now()
  const model = viewer.model as unknown as ViewerModel | undefined
  if (!model) throw new Error('readSnapshot: the viewer has no model loaded')
  const unitString = model.getUnitString()
  const scale = model.getUnitScale()
  const units: Units = IMPERIAL.test(unitString) ? 'ft' : 'm'

  const rows = (await model.getPropertyDb().executeUserFunction(PROPERTY_SCAN, {
    props: PROPS,
    cats: CATEGORIES,
    units: UNIT_FACTORS,
    lengths: LENGTH_PARAMS,
    areas: AREA_PARAMS,
    scale,
  })) as Row[]
  const t1 = performance.now()

  const geo = createGeometryReader(model, scale)
  const levels: Level[] = []
  let basePointNorth: number | undefined
  const kept: Row[] = []
  for (const row of rows) {
    const role = CATEGORIES[row.category]
    if (role === 'level') {
      levels.push({ name: str(row.p.Name) ?? row.name ?? '', elevation: num(row.p.Elevation) ?? 0, dbId: row.dbId })
    } else if (role === 'base-point') {
      basePointNorth = num(row.p['Angle to True North']) ?? basePointNorth
    } else {
      const demolished = str(row.p['Phase Demolished'])
      if ((!demolished || demolished === 'None') && geo.hasFragments(row.dbId)) kept.push(row)
    }
  }

  const walls = new Set(kept.filter((r) => CATEGORIES[r.category] === 'wall').map((r) => r.dbId))
  // Revit nests curtain panels, and windows or doors used as curtain panels, under their curtain wall.
  const parents = new Map<number, number>()
  for (const r of kept) {
    const role = CATEGORIES[r.category]
    if (role !== 'panel' && role !== 'window' && role !== 'door') continue
    const parent = geo.parentOf(r.dbId)
    if (walls.has(parent)) parents.set(r.dbId, parent)
  }
  const curtainHosts = new Set(parents.values())
  const elements = kept.map((row) => toElement(row, curtainHosts, parents.get(row.dbId), geo))
  const t2 = performance.now()

  const node = model.getDocumentNode()
  const north =
    opts.northAngleDeg !== undefined
      ? { source: 'user' as const, angleDeg: opts.northAngleDeg }
      : basePointNorth
        ? { source: 'true-north-param' as const, angleDeg: basePointNorth }
        : { source: 'project' as const, angleDeg: 0 }
  const { triangles, missingGeometry } = geo.stats()
  return {
    modelUrn: node?.getRootNode().urn() ?? model.getData().urn ?? '',
    viewableGuid: node?.guid() ?? '',
    viewableName: node?.name() ?? '',
    units,
    levels,
    elements,
    north,
    takenAt: new Date().toISOString(),
    stats: {
      elements: elements.length,
      triangles,
      missingGeometry,
      propertyScanMs: t1 - t0,
      geometryMs: t2 - t1,
      totalMs: performance.now() - t0,
    },
  }
}

function toElement(
  row: Row,
  curtainHosts: Set<number>,
  parentWall: number | undefined,
  geo: ReturnType<typeof createGeometryReader>,
): Element {
  const role = CATEGORIES[row.category]
  const p = row.p
  const family = row.typed ? (row.name ?? '') : undefined
  const typeName = row.typed ? (str(p['Type Name']) ?? family) : undefined
  const params: Element['params'] = {}
  for (const name of KEPT_PARAMS) if (p[name] !== undefined) params[name] = p[name]
  const element: Element = {
    dbId: row.dbId,
    typeKey: row.typed ? `${family} / ${typeName}` : row.category,
    category: row.category,
    params,
  }
  if (family !== undefined) element.family = family
  if (typeName !== undefined) element.typeName = typeName
  const level = str(p.Level) ?? str(p['Base Constraint'])
  if (level) element.level = level
  if (num(p.Area) !== undefined) element.area = num(p.Area)
  if (num(p.Width) !== undefined) element.width = num(p.Width)
  if (num(p.Height) !== undefined) element.height = num(p.Height)
  if (num(p.Length) !== undefined) element.length = num(p.Length)
  element.bbox = geo.bbox(row.dbId)
  if (parentWall !== undefined) element.hostDbId = parentWall

  const kind: FacadeKind | null =
    role === 'wall'
      ? curtainHosts.has(row.dbId) || /curtain wall/i.test(family ?? '')
        ? 'curtain-wall'
        : 'wall'
      : role === 'panel' || role === 'window' || role === 'door'
        ? role
        : null
  if (kind) {
    const facade = facadeOf(kind, geo.triangles(row.dbId))
    if (facade) element.facade = facade
  } else if (role === 'room') {
    const footprint = footprintOf(geo.triangles(row.dbId), num(p['Base Offset']) ?? 0, ROOM_FLOOR_TOL_M)
    if (footprint) element.footprint = footprint
  }
  return element
}
