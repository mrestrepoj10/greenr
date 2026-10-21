# greenr Convex backend

Persistence for runs, classifications, exclusions and evidence packs. No auth in v1. A project is a URL, keyed by the model slug from `lib/models/catalog.ts`.

## Tables

| Table | Key | Holds |
| --- | --- | --- |
| `projects` | `by_slug` | One row per model slug: URN, viewable, north angle and source. |
| `runs` | `by_projectId_and_computedAt` | A `RunResult` without element ids. `measures[].orientations[]` and `measures[].gaps[]` carry areas and messages only. |
| `runElements` | `by_runId` | Element id lists for a run, chunked at 8000 ids per document. Keys are `<code>:orientation:<N..NW>:wall`, `<code>:orientation:<N..NW>:glazing` and `gap:<id>`. |
| `classifications` | `by_projectId`, `by_projectId_and_typeKey` | One row per type per project. A `user` row is never replaced by a `rule` or `model` row. `classifications.unconfirm` deletes it, so the rules or the model answer again. |
| `exclusions` | `by_projectId`, `by_projectId_and_id` | One row per exclusion id per project with `status: proposed, accepted, rejected`. A decided row is never replaced by a new proposal. `exclusions.decide` sets the status, and setting it back to `proposed` is the undo. |
| `packs` | `by_runId` | Blob URL, size and manifest of an exported evidence pack. |

The split keeps a run under the 1 MB document limit when an orientation holds thousands of walls. `lib/persist/codec.ts` owns the conversion. `toStoredRun(run)` splits a `RunResult` into `{ run, elements, classifications, exclusions }` and `fromStoredRun(doc, elements, classifications, exclusions)` rebuilds it. `runs.latest(projectId)` returns all four in one query so one subscription rebuilds the run. `runs.elementIds(runId, key)` returns one key's ids when a view needs a single list.

## Functions

- `projects.upsert`, `projects.getBySlug`, `projects.setNorth`
- `runs.save`, `runs.latest`, `runs.elementIds`, `runs.list` (last 10, state and computedAt)
- `classifications.listByProject`, `classifications.confirm`, `classifications.unconfirm`, `classifications.saveMany`
- `exclusions.listByProject`, `exclusions.decide` (`status: proposed, accepted, rejected`), `exclusions.saveProposed`
- `packs.save`, `packs.latestForRun`

`runs.save` also folds the run's classifications and exclusions into the project tables with the same never-overwrite-a-user-decision rules as `saveMany` and `saveProposed`.

## Client

`components/convex-provider.tsx` mounts `ConvexProvider` from `NEXT_PUBLIC_CONVEX_URL` and renders children unwrapped when the variable is missing. `lib/persist/hooks.ts` wraps each function with typed args and runs the codec.

## Deploying

Two deployments back the app. Vercel preview reads the dev deployment `fantastic-salamander-425`, the same one `.env.local` points at. Vercel production reads the prod deployment `capable-boar-417`. `NEXT_PUBLIC_CONVEX_URL` holds each URL in its Vercel environment.

Vercel builds with `pnpm build` only. No `CONVEX_DEPLOY_KEY` is set in Vercel, so a build never pushes functions. Push them from the logged-in CLI:

```sh
npx convex dev --once   # dev, read by preview and pnpm dev
npx convex deploy       # prod, read by production
```

Every push to `main` starts a Vercel production build. If a change alters a function's arguments, run `npx convex deploy` before production serves the new build, or the live page calls a function that prod does not have.

`admin.resetProject` is an internal mutation, so only the deployment's CLI can call it. `scripts/verify/e2e.mjs` calls it first to start 210 King from an empty project, on the deployment behind `BASE_URL`. That is prod for `greenr-omega.vercel.app` or when `E2E_PROD=1`, and dev otherwise. To reset by hand:

```sh
npx convex run admin:resetProject '{"slug":"<model slug>"}'          # dev
npx convex run --prod admin:resetProject '{"slug":"<model slug>"}'   # prod
```

To verify the dev deployment's functions end to end, run:

```sh
npx convex dev --once
node --import tsx scripts/verify/unit7-convex.mjs
```
