import { MSC_PAGES, RES_0194 } from '../guide'
import { C_ENV_LABELS } from '../measures/casa/c-env'
import { C_SRI_LABELS } from '../measures/casa/c-sri'
import { C_WATER_LABELS, highestLabel } from '../measures/casa/c-water'
import type { CLIMATE_ZONES, GuideRef, HOUSING_FORMS, MeasureCodeOf, ProjectInputs, TYPOLOGIES } from '../types'
import type { Cardinal } from './orientation4'

/** The option text the MS&C form shows (Anexo 3 §7.2 field 3 and field 6). */
const TYPOLOGY: Record<(typeof TYPOLOGIES)[number], string> = { 'no-vis': 'No VIS', vis: 'VIS', vip: 'VIP' }
const HOUSING: Record<(typeof HOUSING_FORMS)[number], string> = { unifamiliar: 'Unifamiliar', multifamiliar: 'Multifamiliar' }
const CLIMATE: Record<(typeof CLIMATE_ZONES)[number], string> = {
  frio: 'Frío',
  templado: 'Templado',
  'calido-seco': 'Cálido seco',
  'calido-humedo': 'Cálido húmedo',
}

export type MscSource =
  | { kind: 'input'; read: (inputs: ProjectInputs) => string | undefined }
  | { kind: 'measure'; code: MeasureCodeOf<'CASA'>; label: string; percent?: boolean }
  | { kind: 'wwr'; orientation: Cardinal }

export type MscField = { field: string; label: string; unit: string; guide: GuideRef; from: MscSource }

const env = (label: string, percent = false): MscSource => ({ kind: 'measure', code: 'C-ENV', label, percent })
const water = (label: string): MscSource => ({ kind: 'measure', code: 'C-WATER', label })
const p = MSC_PAGES
const measures = RES_0194.mscMeasures

/** The fields greenr can fill, in the order the MS&C form asks them: §7.2 fields 1 to 29, then the §3 measures. */
export const MSC_FIELDS: readonly MscField[] = [
  {
    field: '3',
    label: 'Tipo de proyecto',
    unit: '',
    guide: p[21],
    from: { kind: 'input', read: (i) => (i.typology && i.housingForm ? `${TYPOLOGY[i.typology]} - ${HOUSING[i.housingForm]}` : undefined) },
  },
  { field: '6', label: 'Clima', unit: '', guide: p[21], from: { kind: 'input', read: (i) => (i.climateZone ? CLIMATE[i.climateZone] : undefined) } },
  { field: '13', label: 'Número de pisos arriba de suelo', unit: 'pisos', guide: p[22], from: env(C_ENV_LABELS.floorsAbove) },
  { field: '14', label: 'Número de pisos debajo de suelo', unit: 'pisos', guide: p[22], from: env(C_ENV_LABELS.floorsBelow) },
  { field: '15', label: 'Altura del edificio', unit: 'm', guide: p[22], from: env(C_ENV_LABELS.height) },
  { field: '16', label: 'Altura promedio de piso a piso', unit: 'm', guide: p[23], from: env(C_ENV_LABELS.f2fAverage) },
  { field: '19', label: 'Huella de edificio aproximada', unit: 'm²', guide: p[24], from: env(C_ENV_LABELS.footprint) },
  { field: '21', label: 'Valor U aproximado muro externo', unit: 'W/m²K', guide: p[25], from: env(C_ENV_LABELS.wallU) },
  { field: '24', label: 'Valor U aproximado de cubierta', unit: 'W/m²K', guide: p[27], from: env(C_ENV_LABELS.roofU) },
  { field: '25', label: 'Relación muro/ventana: fachada Norte', unit: '%', guide: p[28], from: { kind: 'wwr', orientation: 'N' } },
  { field: '25', label: 'Relación muro/ventana: fachada Sur', unit: '%', guide: p[28], from: { kind: 'wwr', orientation: 'S' } },
  { field: '25', label: 'Relación muro/ventana: fachada Oriente', unit: '%', guide: p[28], from: { kind: 'wwr', orientation: 'E' } },
  { field: '25', label: 'Relación muro/ventana: fachada Occidente', unit: '%', guide: p[28], from: { kind: 'wwr', orientation: 'W' } },
  { field: '26', label: 'Altura promedio de ventana', unit: 'm', guide: p[28], from: env(C_ENV_LABELS.windowHeight) },
  { field: '28', label: 'Dispositivos de sombra para ventanas', unit: 'elementos', guide: p[29], from: env(C_ENV_LABELS.shading) },
  { field: '29', label: 'Número de ocupantes esperados', unit: 'personas', guide: p[29], from: water(C_WATER_LABELS.occupants) },
  { field: '3.1.1 c', label: 'Vidrios de protección solar: valor U', unit: 'W/m²K', guide: measures, from: env(C_ENV_LABELS.glazingU) },
  { field: '3.1.1 c', label: 'Vidrios de protección solar: SHGC', unit: 'ratio', guide: measures, from: env(C_ENV_LABELS.glazingShgc) },
  {
    field: '3.1.1 d',
    label: 'Cubierta de protección solar: porcentaje de cubierta protegida',
    unit: '%',
    guide: measures,
    from: { kind: 'measure', code: 'C-SRI', label: C_SRI_LABELS.share, percent: true },
  },
  { field: '3.2 a', label: 'Sanitarios de bajo consumo', unit: 'L/descarga', guide: measures, from: water(highestLabel('toilet')) },
  { field: '3.2 b', label: 'Grifería de bajo consumo: lavamanos', unit: 'L/min', guide: measures, from: water(highestLabel('lavatory')) },
  { field: '3.2 b', label: 'Grifería de bajo consumo: cocina', unit: 'L/min', guide: measures, from: water(highestLabel('kitchen')) },
  { field: '3.2 c', label: 'Duchas de bajo consumo', unit: 'L/min', guide: measures, from: water(highestLabel('shower')) },
  { field: '3.2 d', label: 'Orinales de bajo consumo', unit: 'L/descarga', guide: measures, from: water(highestLabel('urinal')) },
]
