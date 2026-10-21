import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { packDoc } from './validators'

export const save = mutation({
  args: { runId: v.id('runs'), url: v.string(), size: v.number(), manifest: v.any() },
  returns: v.id('packs'),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run) throw new Error('404: run not found')
    if (!Number.isFinite(args.size) || args.size < 0) throw new Error('size must be a non-negative number')
    return await ctx.db.insert('packs', { ...args, projectId: run.projectId, createdAt: Date.now() })
  },
})

export const latestForRun = query({
  args: { runId: v.id('runs') },
  returns: v.union(packDoc, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('packs')
      .withIndex('by_runId', (q) => q.eq('runId', args.runId))
      .order('desc')
      .first()
  },
})
