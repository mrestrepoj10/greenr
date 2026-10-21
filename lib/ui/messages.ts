import type {
  ElementRole,
  ExclusionReason,
  ExclusionStatus,
  MeasureBlocker,
  MeasureCodeOf,
  MissingElements,
  ProjectInputKey,
  RunState,
  Scheme,
  UnitSource,
  ValueSource,
} from '@/lib/edge/types'

const SCHEME_SHORT: Record<Scheme, string> = { EDGE: 'EDGE', CASA: 'CASA' }
const SCHEME_NAME: Record<Scheme, string> = { EDGE: 'EDGE', CASA: 'CASA Colombia' }
const listed = (schemes: readonly Scheme[], names: Record<Scheme, string>) => schemes.map((s) => names[s]).join(' and ')

export const messages = {
  app: 'greenr',
  projects: 'Projects',
  panelTitle: 'Scheme pre-check',
  schemes: {
    label: 'Schemes to check',
    options: { EDGE: 'EDGE', CASA: 'CASA', both: 'EDGE + CASA' },
    heading: (scheme: Scheme, version: string) => `${SCHEME_NAME[scheme]} ${version}`,
  },
  check: (schemes: readonly Scheme[]) => `Check for ${listed(schemes, SCHEME_SHORT)}`,
  checkAgain: 'Check again',
  export: 'Export evidence pack',
  exportHint: 'Available once every pending type and exclusion is confirmed.',
  exportStatus: {
    capturing: (side: 'N' | 'E' | 'S' | 'W') =>
      `Capturing the ${{ N: 'north', E: 'east', S: 'south', W: 'west' }[side]} elevation`,
    packing: 'Writing the PDFs, CSV and manifest',
    uploading: 'Uploading the pack',
    failed: 'The evidence pack did not upload. The run is unchanged.',
    author: 'greenr pre-check',
    title: 'Evidence pack',
    share: 'Share link',
    download: 'Download zip',
    copy: 'Copy link',
    copied: 'Link copied',
    size: (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`,
  },
  footer: {
    EDGE: 'EDGE V3.1 user guides. Inputs only. Savings are calculated in the EDGE App.',
    CASA: 'CASA Colombia 3.1 (Edición 2026). Pre-check only. Credits are awarded by CCCS/GBCI on the Arc platform.',
  } satisfies Record<Scheme, string>,
  guide: (doc: string, page: string) => `${doc} p.${page}`,
  empty: {
    title: (schemes: readonly Scheme[]) => `Check this model for ${listed(schemes, SCHEME_NAME)}`,
    lines: (schemes: readonly Scheme[]) => [
      'Reads walls, glazing, roofs, levels and rooms from the loaded view.',
      ...(schemes.includes('EDGE')
        ? ['Measures the EDGE design inputs and the EEM01, EEM02 and EEM09 inputs, with the guide page next to each value.']
        : []),
      ...(schemes.includes('CASA')
        ? ['Lists the CASA Colombia measures with the credits each one serves and its page in the CASA guide.']
        : []),
      'Lists what the model cannot prove, so you confirm element types and exclusions before anything counts.',
    ],
  },
  measuring: 'Reading the model and measuring. Rows fill in as measures finish.',
  phase: {
    snapshot: 'Reading walls, glazing, roofs, levels and rooms from the model.',
    classifying: (n: number) => `Classifying ${n} ${n === 1 ? 'type' : 'types'} the rules could not settle.`,
    measuring: (schemes: readonly Scheme[]) => `Measuring the ${listed(schemes, SCHEME_SHORT)} inputs.`,
  },
  storedRun: (when: string) => `Last check, ${when}. Check again to read the model afresh.`,
  provisionalNote: 'Values are provisional until every pending type is confirmed.',
  needsConfirmation: 'Needs your confirmation',
  nothingPending: 'Nothing pending. Every type and exclusion is decided.',
  decided: {
    title: 'Decided',
    undo: 'Undo',
    status: { proposed: 'Proposed', accepted: 'Accepted', rejected: 'Rejected' } satisfies Record<ExclusionStatus, string>,
    confirmedAs: (role: string) => `Confirmed as ${role}`,
  },
  pendingTypes: 'Element types',
  proposedExclusions: 'Proposed exclusions',
  confidence: 'confidence',
  confirm: 'Confirm',
  accept: 'Accept',
  reject: 'Reject',
  changeRole: 'Change role',
  elements: (n: number) => (n === 1 ? '1 element' : `${n} elements`),
  wwr: {
    title: 'Window-to-wall ratio',
    orientation: 'Orientation',
    wall: 'Wall m²',
    glazing: 'Glazing m²',
    ratio: 'WWR',
    noFacade: 'no façade',
    colour: 'Colour façades',
    clearColour: 'Clear colours',
    legend: 'WWR',
    north: 'North',
    editNorth: 'Edit north',
    northHelp: 'Degrees clockwise from project +Y to true north.',
    apply: 'Apply',
    northSource: {
      project: 'from project',
      'true-north-param': 'from parameter',
      user: 'set by you',
    },
  },
  inputs: { title: 'Design inputs' },
  casa: {
    titles: {
      'C-ENV': 'Envelope sheet',
      'C-FLOOD': 'Flood and road grade',
      'C-VENT': 'Natural ventilation and daylight',
      'C-WATER': 'Water fixtures',
      'C-FLEX': 'Non-structural partitions',
      'C-SRI': 'Roof solar reflectance',
      'C-GLAZE': 'Glazing light transmittance',
    } satisfies Record<MeasureCodeOf<'CASA'>, string>,
    dwellings: {
      title: 'Dwelling units',
      line: (count: number, rule: string) => `${count} ${count === 1 ? 'dwelling unit' : 'dwelling units'}, found by ${rule}.`,
      none: 'No dwelling unit found. CASA reads occupants and glazing per unit, so C-VENT and C-WATER report without them.',
      rules: {
        'comments-tipo': 'Comments "Tipo N" on each level',
        'room-number': 'the room Number prefix',
        department: 'the room Department',
        areas: 'Revit Areas drawn per dwelling',
      } satisfies Record<UnitSource, string>,
      bedrooms: 'Bedrooms',
      bucket: (bedrooms: number, units: number) => `${bedrooms} bd × ${units}`,
      occupants: 'Occupants are bedrooms plus one per unit (GGp8, Gestión de residuos, p. 48).',
    },
    facade: {
      orientation: 'Façade',
      blocked: 'blocked',
      sectors: 'Each façade takes the walls whose outside faces within 45° of its direction.',
    },
    types: {
      glazing: 'Glazing types',
      wall: 'Exterior wall types',
      roof: 'Roof types',
      noValue: 'no U value',
    },
    flood: {
      needs: 'Type these elevations in metres, survey datum. They save to Project inputs.',
      show: 'Show elements',
      showPlane: 'Show flood plane',
      hidePlane: 'Hide flood plane',
      plane: (m: string) => `Flood plane at ${m} m, survey datum`,
    },
    vent: {
      units: 'Glazing per dwelling unit, lowest first',
      rooms: 'Useful opening per room, lowest first',
      unit: 'Unit',
      room: 'Room',
      share: 'Share of floor area',
      noFloor: 'no floor area',
    },
    water: {
      title: 'Fixture types',
      fixture: 'Fixture',
      cap: 'NTC 1500 max',
      model: 'In the model',
      noParameter: (unit: string) => (unit === 'L/min' ? 'no flow parameter' : 'no flush parameter'),
      notNtc: 'not an NTC 1500 fixture',
    },
    gaps: (n: number) => `${n} ${n === 1 ? 'gap' : 'gaps'}`,
    more: (n: number) => `Show ${n} more`,
    cite: (credit: string, name: string | undefined, page: string) => `${credit}${name ? ` (${name})` : ''} p.${page}`,
  },
  /** CASA credit names as the guide prints them, for chips and citations. */
  creditNames: {
    GGc5: 'Estudio bioclimático',
    GGp8: 'Gestión de residuos durante la operación',
    CCRp3: 'Resiliencia del proyecto',
    CCRc4: 'Mejora en la resiliencia del proyecto',
    BEc3: 'Preservación del microclima urbano',
    Ap3: 'Reducción del consumo de agua interior',
    Ep1: 'Eficiencia energética',
    SBp1: 'Calidad del aire interior',
    SBp3: 'Desempeño térmico',
    SBc6: 'Desempeño de la iluminación interior',
    Mc4: 'Circularidad',
    'MS&C §2': 'Materialidad y forma',
    'MS&C §3': 'Medidas de ahorro',
  },
  blocked: {
    label: 'Blocked',
    notImplemented: 'Not measured yet. This CASA measure arrives in a later version of greenr.',
    missingInput: (label: string) => `Needs ${label} under Project inputs.`,
    missingParameter: (parameter: string) => `Needs ${parameter} on the element types listed below, from their data sheets.`,
    unplacedRooms: (count: number, total: number) =>
      `${count} of ${total} rooms are unplaced in this model, so the envelope cannot be probed.`,
    missingElements: {
      'plumbing-fixture': 'No plumbing fixture in this model. Open the plumbing model and check it for CASA.',
      'interior-partition': 'No wall 3 cm or thicker is classified as an interior wall, so there is no partition area to split.',
      'dwelling-unit': 'No dwelling unit found by Comments "Tipo N", a room Number prefix, Department or Revit Areas.',
      'habitable-space': 'No placed habitable room and no dwelling unit, so the habitable floors cannot be found.',
    } satisfies Record<MissingElements, string>,
  },
  credits: 'Serves',
  projectInputs: {
    title: 'Project inputs',
    summary: (set: number, total: number) => `${set} of ${total} set`,
    help: 'CASA and Res. 0194 read these values. greenr never takes them from the model or guesses them from the municipality.',
    unset: 'Not set',
    zoneHelp: 'Pick the zone yourself. A municipality can span several zones (Res. 0194, Art. 5).',
    geovisor: 'Find your zone in the Res. 0194 geovisor',
    options: {
      typology: { 'no-vis': 'No VIS', vis: 'VIS', vip: 'VIP' },
      housingForm: { unifamiliar: 'Unifamiliar', multifamiliar: 'Multifamiliar' },
      municipalityCategory: { E: 'Especial', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6' },
      climateZone: { frio: 'Frío', templado: 'Templado', 'calido-seco': 'Cálido seco', 'calido-humedo': 'Cálido húmedo' },
      floodReturnYears: { '50': '50 years', '100': '100 years' },
      inFloodplain: { true: 'Yes', false: 'No' },
    },
    fields: {
      typology: { label: 'Typology' },
      housingForm: { label: 'Housing form' },
      municipality: { label: 'Municipality, DIVIPOLA code' },
      municipalityCategory: { label: 'Municipality category' },
      climateZone: { label: 'Climate zone' },
      roadGradeM: { label: 'Road grade elevation', unit: 'm' },
      floodElevationM: { label: 'Flood elevation', unit: 'm' },
      floodReturnYears: { label: 'Flood return period', unit: 'years' },
      inFloodplain: { label: 'Inside a floodplain' },
      datumOffsetM: { label: 'Survey datum offset', unit: 'm' },
      projectAreaM2: { label: 'Project area', unit: 'm²' },
    } satisfies Record<ProjectInputKey, { label: string; unit?: string }>,
  },
  dev: {
    terminal: 'fx terminal, the assistant tools as viewer commands. Ctrl+` hides it.',
    close: 'Close the terminal',
  },
  agent: {
    title: 'Ask about this check',
    heading: 'greenr assistant',
    model: 'Model',
    newConversation: 'New conversation',
    expand: 'Show the assistant',
    collapse: 'Hide the assistant',
    placeholder: 'Ask about a value, a gap or an exclusion',
    empty: 'Ask why a wall counts, what a gap means, or which exclusions to accept. The assistant proposes; you confirm in the panel above.',
    firstTurn: 'The check just finished. Walk me through what needs my confirmation.',
    cards: {
      composing: 'Composing the answer',
      notInRun: (code: string, input: string) => `${code} has no input "${input}" in this run`,
      noGaps: 'No gaps in this run.',
      moreGaps: (n: number) => `and ${n} more in the Gaps section`,
      north: (deg: string, source: string) => `North ${deg}, ${source}`,
      suggested: 'Ask next',
    },
    question: {
      legend: 'The assistant asks',
      submit: 'Send answers',
      answered: 'Answered',
      waiting: 'Waiting for your answer',
      chooseOne: 'Choose one',
      chooseAny: 'Choose any',
    },
    tools: {
      summary: 'Read the check summary',
      measure: (code: string) => `Read ${code}`,
      pending: 'Listed what needs your confirmation',
      pendingDetail: (types: number, exclusions: number) =>
        `${types} ${types === 1 ? 'type' : 'types'}, ${exclusions} ${exclusions === 1 ? 'exclusion' : 'exclusions'}`,
      proposedExclusion: (reason: string) => `Proposed an exclusion: ${reason}`,
      proposedRole: (role: string) => `Proposed a role: ${role}`,
    },
  },
  gaps: {
    title: 'Gaps',
    none: (scheme: Scheme) => `No gaps. Every measured type carries the parameters ${SCHEME_NAME[scheme]} asks for.`,
    missing: (parameter: string) => `Missing ${parameter}`,
    severity: {
      'blocks-claim': 'Blocks the claim',
      'needs-data-sheet': 'Needs a data sheet',
      info: 'Information',
    },
  },
  state: {
    idle: 'Not checked',
    loading: 'Loading',
    snapshot: 'Reading model',
    classifying: 'Classifying',
    measuring: 'Measuring',
    provisional: 'Provisional',
    confirmed: 'Confirmed',
    exported: 'Exported',
  } satisfies Record<RunState, string>,
  roles: {
    'exterior-wall': 'Exterior wall',
    'interior-wall': 'Interior wall',
    massing: 'Massing',
    parapet: 'Parapet',
    window: 'Window',
    'curtain-glazed': 'Curtain wall, glazed',
    'curtain-solid': 'Curtain wall, solid',
    door: 'Door',
    skylight: 'Skylight',
    roof: 'Roof',
    floor: 'Floor',
    room: 'Room',
    shading: 'Shading',
    'plumbing-fixture': 'Plumbing fixture',
    'lighting-fixture': 'Lighting fixture',
    equipment: 'Equipment',
    parking: 'Parking',
    planting: 'Planting',
    area: 'Area',
    pipe: 'Pipe',
    other: 'Other',
  } satisfies Record<ElementRole, string>,
  exclusionReasons: {
    'below-grade': 'Below grade',
    massing: 'Massing',
    unconditioned: 'Unconditioned',
    'party-wall': 'Party wall',
    parapet: 'Parapet',
    shaft: 'Shaft',
    user: 'Excluded by you',
  } satisfies Record<ExclusionReason, string>,
  sources: {
    parameter: 'parameter',
    geometry: 'geometry',
    levels: 'levels',
    rooms: 'rooms',
    mixed: 'mixed',
  } satisfies Record<ValueSource, string>,
  errors: {
    viewerNotReady: 'The viewer is still loading. Try again once the model is in.',
    checkFailed: 'The check did not finish. The viewer stayed as it was.',
    saveFailed: 'The last change shows here but did not reach the project store. Check again to retry.',
    unclassified: (n: number) =>
      `${n} ${n === 1 ? 'type' : 'types'} could not be classified automatically. Confirm ${n === 1 ? 'it' : 'them'} under Needs your confirmation.`,
  },
} as const

/** One sentence per blocker, the same in the panel, the PDFs and the agent's tools. */
export function blockerText(blocker: MeasureBlocker): string {
  switch (blocker.kind) {
    case 'missing-input':
      return messages.blocked.missingInput(messages.projectInputs.fields[blocker.input].label)
    case 'missing-parameter':
      return messages.blocked.missingParameter(blocker.parameter)
    case 'unplaced-rooms':
      return messages.blocked.unplacedRooms(blocker.count, blocker.total)
    case 'missing-elements':
      return messages.blocked.missingElements[blocker.elements]
    case 'not-implemented':
      return messages.blocked.notImplemented
  }
}
