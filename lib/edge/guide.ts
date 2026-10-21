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

/** The Minvivienda scans have no cover: "Página 7 de 15" is PDF page 7. */
const minvivienda = (file: string, doc: string, page: number, title: string): GuideRef => ({
  doc,
  version: RES_0194_EDITION,
  page: String(page),
  title,
  url: `${MINVIVIENDA}/${file}#page=${page}`,
})

export const GUIDE: Record<MeasureCode, GuideRef> = {
  'D-GIA': edge(2, 20, 'Building Data: Gross Internal Area (IPMS 2)'),
  'D-FLOORS': edge(2, 17, 'No. of Floors Above/Below Grade: below grade when more than 50% of its wall area is below ground', '20'),
  'D-F2F': edge(2, 20, 'Floor to Floor Height: area-weighted when floor heights differ'),
  'D-ROOF': edge(2, 20, 'Aggregate Roof Area'),
  EEM01: edge(3, 11, 'EEM01 Window-to-Wall Ratio'),
  EEM02: edge(3, 16, 'EEM02 Reflective Roof'),
  EEM09: edge(3, 43, 'EEM09 Efficiency of Glass'),
  'AU-SKYLIGHT': edge(3, 97, 'EEM25 Skylights: mandatory when skylights cover 1% or more of the roof area'),
  'C-ENV': casa(30, 'GGc5 Estudio bioclimático: window-to-wall ratio per main façade'),
  'C-FLOOD': casa(68, 'CCRp3 Resiliencia del proyecto: lowest habitable floor at or above road grade'),
  'C-VENT': casa(172, 'SBp1 Calidad del aire interior: natural ventilation opening per room'),
  'C-WATER': casa(124, 'Ap3 Reducción del consumo de agua interior: fixture flows against NTC 1500'),
  'C-FLEX': casa(236, 'Mc4 Circularidad: share of non-structural interior partitions'),
  'C-SRI': casa(94, 'BEc3 Preservación del microclima urbano: roof SRI by slope'),
  'C-GLAZE': casa(202, 'SBc6 Desempeño de la iluminación interior: glazing visible light transmittance'),
}

export const SKYLIGHT_AUDIT_GUIDE: GuideRef = edge(
  8,
  35,
  'Site audit: skylights covering more than 5% of the aggregate roof area make EEM25 mandatory',
)

export const RES_0194 = {
  climateZone: minvivienda('0194-2025.pdf', 'Resolución 0194 de 2025', 7, 'Art. 5 Zonificación climática: Anexo 2 and the geovisor place the site'),
  municipalities: minvivienda('anexo-2-informacion-climatica-por-municipios.pdf', 'Res. 0194 Anexo 2', 1, 'Información climática por municipios'),
  msc: minvivienda('anexo-3-mecanismo-de-seguimiento-y-control_0.pdf', 'Res. 0194 Anexo 3 (MS&C)', 43, 'MS&C form §2 Materialidad y forma: window-to-wall ratio per façade'),
} satisfies Record<string, GuideRef>

export const CLIMATE_GEOVISOR_URL =
  'https://geoportal.minvivienda.gov.co/portal/apps/instant/interactivelegend/index.html?appid=f1381a0031e14ec8957fe8c9ef017054'

/** One citation format for every surface: "EDGE Part 3, V3.1, p. 11". */
export const citation = (guide: GuideRef): string => `${guide.doc}, ${guide.version}, p. ${guide.page}`
