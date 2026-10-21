# greenr build plan

greenr opens a Revit model in the Autodesk viewer and measures the EDGE V3.1 design inputs a consultant types into the EDGE App today. It colours the model by the result, lists what the model cannot prove, and exports an auditor-shaped evidence pack. It never shows savings or pass/fail.

## Done, as a predicate

On the deployed site, a person picks 210 King Street from the model list, clicks "Check for EDGE", and within 60 seconds sees:

1. The model loaded in the "New Construction" view.
2. Façades coloured by window-to-wall ratio and a table of eight orientations with wall area, glazing area and WWR, each row selecting its walls in the viewer.
3. Design inputs: gross internal area proxy, floors above and below grade, area-weighted floor-to-floor height, roof area, skylight share of roof area.
4. A gaps list: glazing types with no U, SHGC or VT, roof types with no SRI, with the EDGE code and the guide page next to each.
5. The agent proposing exclusions (massing walls, below-grade levels) through a confirm step, and the numbers recomputing when confirmed.
6. "Export evidence pack" producing a zip with one PDF per measure, a CSV mirroring the EDGE calculator fields with explicit zeros, and a JSON manifest, uploaded to Blob with a share link.
7. The run persisted in Convex so reopening the project shows the last result.

A scripted agent-browser run at `scripts/verify/*.mjs` asserts each of these against the real page. README carries screenshots and a GIF from that run.

## Rigor

High on the measurement engine (pure functions with fixture tests, hand-checked against façade names in the model). Medium on UI and persistence (reversible). One-way doors already closed in grilling: name, stack, browser-side agent, bucket models.

## Domain model

Types live in `lib/edge/types.ts`. Logic lives in `lib/edge/*` as pure functions over these shapes, with no viewer imports, so the same code runs in tests and in the browser.

```ts
type Orientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

type ElementRole =
  | 'exterior-wall' | 'interior-wall' | 'massing' | 'parapet'
  | 'window' | 'curtain-glazed' | 'curtain-solid' | 'door' | 'skylight'
  | 'roof' | 'floor' | 'room' | 'shading' | 'other'

type Classification = {
  typeKey: string           // family + type name, the unit the user confirms
  role: ElementRole
  source: 'rule' | 'model' | 'user'
  confidence: number        // 1 for rule and user
}

type Exclusion = { dbIds: number[]; reason: 'below-grade' | 'massing' | 'unconditioned' | 'party-wall' | 'parapet' | 'user' }

type Element = {           // one row of the snapshot read from the viewer
  dbId: number; typeKey: string; category: string; level?: string
  area?: number; width?: number; height?: number; length?: number
  normal?: [number, number, number]; bbox?: [number, number, number, number, number, number]
  params: Record<string, number | string | null>
}

type Snapshot = { modelUrn: string; viewableGuid: string; units: 'ft' | 'm'; levels: Level[]; elements: Element[]; north: { source: 'project' | 'user'; angleDeg: number } }

type RunState = 'idle' | 'loading' | 'snapshot' | 'classifying' | 'measuring' | 'provisional' | 'confirmed' | 'exported'

type Measure = { code: 'EEM01' | 'D-GIA' | ... ; guide: { part: number; page: string }; compute(snapshot, classifications, exclusions): MeasureResult }
```

The measures are a registry (`lib/edge/measures.ts`), one entry per EDGE code, so adding EEM04 later is one row, not a new branch. The run is a state machine, not a set of booleans. Classification rules are a table from `(category, Function, family pattern)` to `ElementRole`.

## Units

Riskiest unknown first. Each unit ends in a check and a commit.

| # | Unit | Check | Owner |
|---|------|-------|-------|
| 0 | Spike: WWR per orientation from viewer geometry on 210 King | RESULT.md with per-orientation table and agreement vs façade names | spike agent |
| 1 | Scaffold: viewer loads "New Construction", token route, model list from bucket, Convex init, preview deploy | agent-browser screenshot of the loaded model on the preview URL | scaffold agent |
| 2 | Engine: `lib/edge/*` pure functions with fixture from the spike snapshot | `pnpm test` green, WWR matches spike within 1% | engine agent |
| 3 | Classification: rules table, Jev via gateway for leftovers, confirm UI | fixture test, UI shows confidence and isolates on click | classify agent |
| 4 | Panel UI: Check button, orientation table, inputs, gaps, colouring, compass | agent-browser run `verify/panel.mjs` | ui agent (fable, medium) |
| 5 | Agent: fx in browser, EDGE tools, ask_user_question, json-render catalog | agent proposes exclusions on a fresh run, confirm recomputes | agent agent |
| 6 | Export: PDFs, CSV, manifest, zip, Blob route, share link | downloaded zip opens, CSV has 8 rows with zeros | export agent |
| 7 | Persistence: runs, classifications, exclusions in Convex | reload shows last run | persist agent |
| 8 | README, screenshots, GIF, GitHub issues, production deploy | predicate script green on production | me |

Units 2, 3 and 6 are disjoint directories and run in parallel worktrees after unit 1. Units 4 and 5 integrate and run after 2 and 3. Unit 7 touches `convex/` and the panel's save hooks, after 4.

## Decision trail

`.audit/greenr.tsv`, committed. One row per unit result, pivot, or revert.
