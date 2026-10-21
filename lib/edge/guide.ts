import type { GuideRef, MeasureCode, Scheme } from './types'

export const GUIDE_VERSIONS: Record<Scheme, string> = {
  EDGE: 'V3.1',
  CASA: '3.1 (Edición 2026)',
}

const EDGE_PARTS = {
  2: 'https://edgebuildings.com/wp-content/uploads/2024/11/Part-2-User-Guide-Design-Tab-Rev-1.pdf',
  3: 'https://edgebuildings.com/wp-content/uploads/2024/11/Part-3-User-Guide-Energy-Measures-Rev-1.pdf',
  8: 'https://edgebuildings.com/wp-content/uploads/2025/07/Part-8-Auditor-Guidance-Rev-1.pdf',
} as const
const CASA_PDF = 'https://casa.cccs.org.co/wp-content/uploads/2026/08/2026_CASA-Colombia-V3.pdf'
const MINVIVIENDA = 'https://minvivienda.gov.co/sites/default/files/normativa'
const RES_0194_EDITION = 'Diario Oficial 53.097'

/** `page` is the printed page number; the URL fragment is the PDF page, one higher because of the cover. */
const edge = (part: keyof typeof EDGE_PARTS, page: number, title: string, also?: string): GuideRef => ({
  doc: `EDGE Part ${part}`,
  version: GUIDE_VERSIONS.EDGE,
  page: also ? `${page}, ${also}` : String(page),
  title,
  url: `${EDGE_PARTS[part]}#page=${page + 1}`,
})

/** Same cover offset as EDGE: "Página 30 de 274" is PDF page 31. */
const casa = (page: number, title: string): GuideRef => ({
  doc: 'CASA Colombia',
  version: GUIDE_VERSIONS.CASA,
  page: String(page),
  title,
  url: `${CASA_PDF}#page=${page + 1}`,
})

/** The resolution scan has no cover: "Página 7 de 15" is PDF page 7. Anexo 3 prints 40 on PDF page 43, so it passes its offset. */
const minvivienda = (file: string, doc: string, page: number, title: string, pdfOffset = 0): GuideRef => ({
  doc,
  version: RES_0194_EDITION,
  page: String(page),
  title,
  url: `${MINVIVIENDA}/${file}#page=${page + pdfOffset}`,
})

const ANEXO_3 = 'anexo-3-mecanismo-de-seguimiento-y-control_0.pdf'
const anexo3 = (page: number, title: string): GuideRef => minvivienda(ANEXO_3, 'Res. 0194 Anexo 3 (MS&C)', page, title, 3)

export const GUIDE: Record<MeasureCode, GuideRef> = {
  'D-GIA': edge(2, 20, 'Building Data: Gross Internal Area (IPMS 2)'),
  'D-FLOORS': edge(2, 17, 'No. of Floors Above/Below Grade: below grade when more than 50% of its wall area is below ground', '20'),
  'D-F2F': edge(2, 20, 'Floor to Floor Height: area-weighted when floor heights differ'),
  'D-ROOF': edge(2, 20, 'Aggregate Roof Area'),
  EEM01: edge(3, 11, 'EEM01 Window-to-Wall Ratio'),
  EEM02: edge(3, 16, 'EEM02 Reflective Roof'),
  EEM09: edge(3, 43, 'EEM09 Efficiency of Glass'),
  'AU-SKYLIGHT': edge(3, 97, 'EEM25 Skylights: mandatory when skylights cover 1% or more of the roof area'),
  'C-ENV': casa(31, 'GGc5 Estudio bioclimático: window-to-wall ratio of each main façade'),
  'C-FLOOD': casa(69, 'CCRp3 Tabla 12: lowest occupied floor at or above road grade'),
  'C-VENT': casa(172, 'SBp1 Caso A: useful opening above 4% of each space\'s floor area'),
  'C-WATER': casa(125, 'Ap3 Tabla 28: NTC 1500 maximum fixture flows'),
  'C-FLEX': casa(236, 'Mc4 Alternativa b: non-structural partitions and 2.40 m between slabs'),
  'C-SRI': casa(94, 'BEc3 Preservación del microclima urbano: roof SRI by slope'),
  'C-GLAZE': casa(204, 'SBc6 Opción 2 Alternativa 1: glazing visible light transmittance above 40%'),
}

/** The page of each CASA credit a measure feeds, at the paragraph that sets its number. Printed pages, checked against the PDF text. */
export const CASA_CREDITS = {
  GGc5: casa(31, 'GGc5 Estudio bioclimático: window-to-wall ratio of each of the 4 main façades'),
  GGp8: casa(48, 'GGp8 Gestión de residuos: inhabitants per dwelling are bedrooms plus one, in every calculation'),
  CCRp3: casa(69, 'CCRp3 Tabla 12: lowest occupied floor at or above road grade; 100-year study in a floodplain'),
  CCRc4: casa(76, 'CCRc4 Tabla 15: entry level, habitable spaces and openings above the 50-year flood elevation (100 in a floodplain)'),
  BEc3: casa(94, 'BEc3: roof SRI above 32 when steeper than 9.5°, above 64 at 9.5° or less'),
  Ap3: casa(124, 'Ap3 Tabla 27: minimum water saving by climate zone'),
  'Ap3 Tabla 28': casa(125, 'Ap3 Tabla 28: NTC 1500 maximum flows and flushes'),
  Ep1: casa(153, 'Ep1 Opción 2: prescriptive envelope, elements next to dwellings only'),
  SBp1: casa(172, 'SBp1 Caso A: useful opening above 4% of each space\'s floor area'),
  SBp3: casa(190, 'SBp3: wall-to-window ratio for each orientation'),
  SBc6: casa(204, 'SBc6 Opción 2 Alternativa 1: glazing at least 15% of each unit\'s floor area, VLT above 40%'),
  Mc4: casa(236, 'Mc4 Alternativa b: over 50% of partition wall area non-structural, at least 2.40 m between slabs'),
} satisfies Record<string, GuideRef>

export const SKYLIGHT_AUDIT_GUIDE: GuideRef = edge(
  8,
  35,
  'Site audit: skylights covering more than 5% of the aggregate roof area make EEM25 mandatory',
)

export const RES_0194 = {
  climateZone: minvivienda('0194-2025.pdf', 'Resolución 0194 de 2025', 7, 'Art. 5 Zonificación climática: Anexo 2 and the geovisor place the site'),
  municipalities: minvivienda('anexo-2-informacion-climatica-por-municipios.pdf', 'Res. 0194 Anexo 2', 1, 'Información climática por municipios'),
  msc: anexo3(40, 'MS&C form §2 Materialidad y forma: window-to-wall ratio per façade'),
  mscMeasures: anexo3(41, 'MS&C form §3 Medidas: solar protection glass and roof, low-flow fixtures'),
} satisfies Record<string, GuideRef>

/** The page each credit a measure serves cites: the CASA credit, or the MS&C form section. */
export const CREDIT_GUIDES: Record<string, GuideRef> = {
  ...CASA_CREDITS,
  'MS&C §2': RES_0194.msc,
  'MS&C §3': RES_0194.mscMeasures,
}

/** The MS&C web form's fields as Anexo 3 §7.2 numbers and explains them, by printed page. */
export const MSC_PAGES = {
  21: anexo3(21, 'MS&C §7.2 fields 1 to 10: project type, climate zone, built area'),
  22: anexo3(22, 'MS&C §7.2 fields 11 to 15: floors above and below ground, building height'),
  23: anexo3(23, 'MS&C §7.2 fields 16 and 17: average floor-to-floor and floor-to-ceiling heights'),
  24: anexo3(24, 'MS&C §7.2 fields 18 and 19: building form and footprint'),
  25: anexo3(25, 'MS&C §7.2 fields 20 and 21: exterior wall material and U value'),
  27: anexo3(27, 'MS&C §7.2 field 24: roof U value'),
  28: anexo3(28, 'MS&C §7.2 fields 25 to 27: window-to-wall ratio per façade, average window height, window type'),
  29: anexo3(29, 'MS&C §7.2 fields 28 and 29: shading devices, expected occupants'),
} satisfies Record<number, GuideRef>

export const CLIMATE_GEOVISOR_URL =
  'https://geoportal.minvivienda.gov.co/portal/apps/instant/interactivelegend/index.html?appid=f1381a0031e14ec8957fe8c9ef017054'

/** One citation format for every surface: "EDGE Part 3, V3.1, p. 11". */
export const citation = (guide: GuideRef): string => `${guide.doc}, ${guide.version}, p. ${guide.page}`
