import type { GuideRef, MeasureCode } from './types'

const PART2 = 'https://edgebuildings.com/wp-content/uploads/2024/11/Part-2-User-Guide-Design-Tab-Rev-1.pdf'
const PART3 = 'https://edgebuildings.com/wp-content/uploads/2024/11/Part-3-User-Guide-Energy-Measures-Rev-1.pdf'
const PART8 = 'https://edgebuildings.com/wp-content/uploads/2025/07/Part-8-Auditor-Guidance-Rev-1.pdf'

/** `page` is the printed page number; the URL fragment is the PDF page, one higher because of the cover. */
const ref = (part: GuideRef['part'], base: string, page: number, title: string, also?: string): GuideRef => ({
  part,
  page: also ? `${page}, ${also}` : String(page),
  title,
  url: `${base}#page=${page + 1}`,
})

export const GUIDE: Record<MeasureCode, GuideRef> = {
  'D-GIA': ref(2, PART2, 20, 'Building Data: Gross Internal Area (IPMS 2)'),
  'D-FLOORS': ref(2, PART2, 17, 'No. of Floors Above/Below Grade: below grade when more than 50% of its wall area is below ground', '20'),
  'D-F2F': ref(2, PART2, 20, 'Floor to Floor Height: area-weighted when floor heights differ'),
  'D-ROOF': ref(2, PART2, 20, 'Aggregate Roof Area'),
  EEM01: ref(3, PART3, 11, 'EEM01 Window-to-Wall Ratio'),
  EEM02: ref(3, PART3, 16, 'EEM02 Reflective Roof'),
  EEM09: ref(3, PART3, 43, 'EEM09 Efficiency of Glass'),
  'AU-SKYLIGHT': ref(3, PART3, 97, 'EEM25 Skylights: mandatory when skylights cover 1% or more of the roof area'),
}

export const SKYLIGHT_AUDIT_GUIDE: GuideRef = ref(
  8,
  PART8,
  35,
  'Site audit: skylights covering more than 5% of the aggregate roof area make EEM25 mandatory',
)
