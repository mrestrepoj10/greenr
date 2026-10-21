import type { Element, Snapshot } from '@/lib/edge/types'

type Row = [
  dbId: number,
  category: string,
  family: string,
  typeName: string,
  params?: Element['params'],
  hostDbId?: number,
]

const row = ([dbId, category, family, typeName, params = {}, hostDbId]: Row): Element => ({
  dbId,
  typeKey: `${family} / ${typeName}`,
  category,
  family,
  typeName,
  params,
  ...(hostDbId === undefined ? {} : { hostDbId }),
})

/** Synthetic rows shaped like 210 King and Commercial Office. Each type exercises one rule, the last two none. */
export const FIXTURE_ROWS: Row[] = [
  [1, 'Revit Walls', 'Basic Wall', 'Exterior - Brick on Block', { 'Construction::Function': 'Exterior' }],
  [2, 'Revit Walls', 'Basic Wall', 'Exterior - Brick on Block', { 'Construction::Function': 'Exterior' }],
  [3, 'Revit Walls', 'Basic Wall', 'Interior - Partition', { Function: 'Interior' }],
  [4, 'Revit Walls', 'Basic Wall', 'Shaft Wall', { Function: 'Core-shaft' }],
  [5, 'Revit Walls', 'Basic Wall', 'Generic - Massing', { Function: 'Exterior' }],
  [6, 'Revit Walls', 'Massing_Wall', 'Massing_Wall', { Function: 'Exterior' }],
  [7, 'Revit Walls', 'Basic Wall', 'Parapet - 200mm', { Function: 'Exterior' }],
  [8, 'Revit Walls', 'Basic Wall', 'Foundation - 300mm Concrete', { Function: 'Foundation' }],
  [9, 'Revit Walls', 'Curtain Wall', 'System Panel / Glazed'],
  [10, 'Revit Curtain Panels', 'System Panel', 'Glazed CENTER'],
  [11, 'Revit Curtain Panels', 'CW_SYS_PNL_WINDOW', 'CW_SYS_PNL_WINDOW'],
  [12, 'Revit Curtain Panels', 'System Panel', 'Spandrel - Aluminium'],
  [13, 'Revit Walls', 'Curtain Wall', 'Solid Wood Panel'],
  [14, 'Revit Curtain Wall Mullions', 'Rectangular Mullion', '50 x 150mm'],
  [15, 'Revit Windows', 'South Wall', '1200 x 1800mm'],
  [16, 'Revit Windows', 'Velux', 'Skylight 780 x 1400'],
  [17, 'Revit Windows', 'Roof Window', 'Fixed 1000 x 1000', {}, 19],
  [18, 'Revit Doors', 'Single-Flush', '915 x 2134mm'],
  [19, 'Revit Roofs', 'Basic Roof', 'Warm Roof - Concrete'],
  [20, 'Revit Floors', 'Floor', 'Concrete 200mm'],
  [21, 'Revit Rooms', 'Room', 'Room'],
  [22, 'Revit Generic Models', 'SHADE SUPPORT', 'SHADE SUPPORT'],
  [23, 'Revit Generic Models', 'Horizontal Louvre', 'Louvre 300'],
  [24, 'Revit Structural Columns', 'Concrete Column', '400 x 400'],
  [25, 'Revit Furniture', 'Desk', '1800 x 900'],
  [26, 'Revit Walls', 'Basic Wall', 'Generic - 200mm', { Function: '' }],
  [27, 'Revit Generic Models', 'Cornice', 'Cornice Type 1'],
]

export const FIXTURE_ELEMENTS: Element[] = FIXTURE_ROWS.map(row)

export const FIXTURE_SNAPSHOT: Snapshot = {
  modelUrn: 'urn:fixture',
  viewableGuid: 'fixture',
  viewableName: 'New Construction',
  units: 'ft',
  levels: [{ name: 'Level 1', elevation: 0 }],
  elements: FIXTURE_ELEMENTS,
  north: { source: 'project', angleDeg: 0 },
  takenAt: '2026-10-21T00:00:00Z',
}
