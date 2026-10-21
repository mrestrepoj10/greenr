# greenr Convex backend

Persistence for runs, classifications, exclusions and evidence packs. No auth in v1. A project is a URL, keyed by the model slug from `lib/models/catalog.ts`.

## Tables

| Table | Key | Holds |
| --- | --- | --- |
| `projects` | `by_slug` | One row per model slug: URN, viewable, north angle and source. |
| `runs` | `by_projectId_and_computedAt` | A `RunResult` without element ids. `measures[].orientations[]` and `measures[].gaps[]` carry areas and messages only. |
| `runElements` | `by_runId` | Element id lists for a run, chunked at 8000 ids per document. Keys are `<code>:orientation:<N..NW>:wall`, `<code>:orientation:<N..NW>:glazing` and `gap:<id>`. |
| `classifications` | `by_projectId`, `by_projectId_and_typeKey` | One row per type per project. A `user` row is never replaced by a `rule` or `model` row. |
| `exclusions` | `by_projectId`, `by_projectId_and_id` | One row per exclusion id per project with `status: proposed, accepted, rejected`. A decided row is never replaced by a new proposal. |
| `packs` | `by_runId` | Blob URL, size and manifest of an exported evidence pack. |

The split keeps a run under the 1 MB document limit when an orientation holds thousands of walls. `lib/persist/codec.ts` owns the conversion. `toStoredRun(run)` splits a `RunResult` into `{ run, elements, classifications, exclusions }` and `fromStoredRun(doc, elements, classifications, exclusions)` rebuilds it. `runs.latest(projectId)` returns all four in one query so one subscription rebuilds the run. `runs.elementIds(runId, key)` returns one key's ids when a view needs a single list.

## Functions

- `projects.upsert`, `projects.getBySlug`, `projects.setNorth`
- `runs.save`, `runs.latest`, `runs.elementIds`, `runs.list` (last 10, state and computedAt)
- `classifications.listByProject`, `classifications.confirm`, `classifications.saveMany`
- `exclusions.listByProject`, `exclusions.decide`, `exclusions.saveProposed`
- `packs.save`, `packs.latestForRun`

`runs.save` also folds the run's classifications and exclusions into the project tables with the same never-overwrite-a-user-decision rules as `saveMany` and `saveProposed`.

## Client

`components/convex-provider.tsx` mounts `ConvexProvider` from `NEXT_PUBLIC_CONVEX_URL` and renders children unwrapped when the variable is missing. `lib/persist/hooks.ts` wraps each function with typed args and runs the codec.

## Deploying

Vercel builds with `pnpm build` only. No `CONVEX_DEPLOY_KEY` is set in Vercel, so functions are not pushed from the build. Before a production deploy, push them from a logged-in CLI:

```sh
npx convex deploy
```

Then set `NEXT_PUBLIC_CONVEX_URL` in Vercel's production environment to the production deployment URL that `npx convex deploy` prints. TODO for the integration step: that variable is not set yet, and the dev deployment `fantastic-salamander-425` is what `.env.local` points at.

Verify the dev deployment end to end with:

```sh
npx convex dev --once
node --import tsx scripts/verify/unit7-convex.mjs
```
