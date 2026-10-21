import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import type { Doc } from './_generated/dataModel'

type LegacyGuide = { part: number; page: string; title: string; url: string }
type LegacyRun = Omit<Doc<'runs'>, 'schemes' | 'guides' | 'inputs' | 'measures'> & {
  guideVersion: string
  measures: (Omit<Doc<'runs'>['measures'][number], 'guide'> & { guide: LegacyGuide })[]
}

/** One-off move of runs saved before schemes: EDGE only, no inputs, guide part N as the document "EDGE Part N".
 * Runs while the schema is not enforced; a run already in the new shape is left alone, so it can run twice. */
export const migrateToSchemes = internalMutation({
  args: {},
  returns: v.object({ runs: v.number() }),
  handler: async (ctx) => {
    let runs = 0
    for (const doc of await ctx.db.query('runs').collect()) {
      if (!('guideVersion' in doc)) continue
      const run = doc as unknown as LegacyRun
      await ctx.db.replace(run._id, {
        projectId: run.projectId,
        runId: run.runId,
        state: run.state,
        schemes: ['EDGE'],
        guides: { EDGE: run.guideVersion, CASA: '3.1 (Edición 2026)' },
        inputs: {},
        snapshot: run.snapshot,
        measures: run.measures.map(({ guide: { part, ...guide }, ...m }) => ({ ...m, guide: { doc: `EDGE Part ${part}`, version: run.guideVersion, ...guide } })),
        computedAt: run.computedAt,
        elementCount: run.elementCount,
      })
      runs++
    }
    return { runs }
  },
})

/** Deletes one project's runs, element chunks, packs, classifications and exclusions, so a verify run starts clean.
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
    await ctx.db.patch(project._id, { northAngleDeg: 0, northSource: 'project', updatedAt: Date.now() })
    return { runs: runs.length, classifications: classifications.length, exclusions: exclusions.length }
  },
})
