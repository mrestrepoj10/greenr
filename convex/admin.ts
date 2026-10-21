import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

/** Deletes one project's runs, element chunks, packs, classifications and exclusions and puts it back to EDGE only with
 * no inputs, so a verify run starts clean.
 * Internal: only the deployment's CLI can call it (`npx convex run admin:resetProject`). */
export const resetProject = internalMutation({
  args: { slug: v.string() },
  returns: v.object({ runs: v.number(), classifications: v.number(), exclusions: v.number() }),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
    if (!project) return { runs: 0, classifications: 0, exclusions: 0 }
    const runs = await ctx.db
      .query('runs')
      .withIndex('by_projectId_and_computedAt', (q) => q.eq('projectId', project._id))
      .collect()
    for (const run of runs) {
      const elements = await ctx.db
        .query('runElements')
        .withIndex('by_runId', (q) => q.eq('runId', run._id))
        .collect()
      for (const element of elements) await ctx.db.delete(element._id)
      const packs = await ctx.db
        .query('packs')
        .withIndex('by_runId', (q) => q.eq('runId', run._id))
        .collect()
      for (const pack of packs) await ctx.db.delete(pack._id)
      await ctx.db.delete(run._id)
    }
    const classifications = await ctx.db
      .query('classifications')
      .withIndex('by_projectId', (q) => q.eq('projectId', project._id))
      .collect()
    for (const row of classifications) await ctx.db.delete(row._id)
    const exclusions = await ctx.db
      .query('exclusions')
      .withIndex('by_projectId', (q) => q.eq('projectId', project._id))
      .collect()
    for (const row of exclusions) await ctx.db.delete(row._id)
    await ctx.db.patch(project._id, { northAngleDeg: 0, northSource: 'project', schemes: ['EDGE'], inputs: {}, updatedAt: Date.now() })
    return { runs: runs.length, classifications: classifications.length, exclusions: exclusions.length }
  },
})
