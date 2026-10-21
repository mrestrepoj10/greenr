import { v } from 'convex/values'
import { mutation, query, type QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import {
  classificationDoc,
  classificationFields,
  exclusionDoc,
  exclusionFields,
  runDoc,
  runElementDoc,
  runElementFields,
  runFields,
  runState,
} from './validators'
import { upsertClassifications } from './classifications'
import { upsertProposedExclusions } from './exclusions'

const HISTORY_LENGTH = 10

async function elementsOf(ctx: QueryCtx, runId: Id<'runs'>) {
  return await ctx.db
    .query('runElements')
    .withIndex('by_runId', (q) => q.eq('runId', runId))
    .collect()
}

async function latestRun(ctx: QueryCtx, projectId: Id<'projects'>) {
  return await ctx.db
    .query('runs')
    .withIndex('by_projectId_and_computedAt', (q) => q.eq('projectId', projectId))
    .order('desc')
    .first()
}

/** Writes one run plus its element id chunks, and folds the run's classifications and exclusions
 * into the project tables with the same never-overwrite-a-user-decision rules as saveMany and saveProposed. */
export const save = mutation({
  args: {
    projectId: v.id('projects'),
    run: v.object(runFields),
    elements: v.array(v.object(runElementFields)),
    classifications: v.array(v.object(classificationFields)),
    exclusions: v.array(v.object(exclusionFields)),
  },
  returns: v.id('runs'),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error('404: project not found')
    const runId = await ctx.db.insert('runs', { projectId: args.projectId, ...args.run })
    for (const element of args.elements) {
      await ctx.db.insert('runElements', { runId, ...element })
    }
    await upsertClassifications(ctx, args.projectId, args.classifications)
    await upsertProposedExclusions(ctx, args.projectId, args.exclusions)
    await ctx.db.patch(args.projectId, { updatedAt: Date.now() })
    return runId
  },
})

/** The newest run with its element chunks, plus the project's current classifications and exclusions,
 * so one subscription rebuilds a RunResult via fromStoredRun. */
export const latest = query({
  args: { projectId: v.id('projects') },
  returns: v.union(
    v.object({
      run: runDoc,
      elements: v.array(runElementDoc),
      classifications: v.array(classificationDoc),
      exclusions: v.array(exclusionDoc),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const run = await latestRun(ctx, args.projectId)
    if (!run) return null
    const [elements, classifications, exclusions] = await Promise.all([
      elementsOf(ctx, run._id),
      ctx.db
        .query('classifications')
        .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
        .collect(),
      ctx.db
        .query('exclusions')
        .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
        .collect(),
    ])
    return { run, elements, classifications, exclusions }
  },
})

export const elementIds = query({
  args: { runId: v.id('runs'), key: v.string() },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const chunks = (await elementsOf(ctx, args.runId)).filter((e) => e.key === args.key)
    chunks.sort((a, b) => a.chunk - b.chunk)
    return chunks.flatMap((c) => c.dbIds)
  },
})

export const list = query({
  args: { projectId: v.id('projects') },
  returns: v.array(v.object({ _id: v.id('runs'), state: runState, computedAt: v.string() })),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('runs')
      .withIndex('by_projectId_and_computedAt', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .take(HISTORY_LENGTH)
    return rows.map((r) => ({ _id: r._id, state: r.state, computedAt: r.computedAt }))
  },
})
