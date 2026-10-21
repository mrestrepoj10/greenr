import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { northSource, projectDoc, projectFields } from './validators'

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(projectDoc, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
  },
})

export const upsert = mutation({
  args: projectFields,
  returns: v.id('projects'),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now })
      return existing._id
    }
    return await ctx.db.insert('projects', { ...args, createdAt: now, updatedAt: now })
  },
})

export const setNorth = mutation({
  args: { projectId: v.id('projects'), northAngleDeg: v.number(), northSource },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.northAngleDeg)) throw new Error('northAngleDeg must be a finite number')
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error('404: project not found')
    await ctx.db.patch(args.projectId, {
      northAngleDeg: ((args.northAngleDeg % 360) + 360) % 360,
      northSource: args.northSource,
      updatedAt: Date.now(),
    })
    return null
  },
})
