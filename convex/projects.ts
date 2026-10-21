import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Infer } from 'convex/values'
import { northSource, projectDoc, projectFields, projectInputs, scheme } from './validators'

const SCHEME_ORDER = ['EDGE', 'CASA'] as const
const NEW_PROJECT_SCOPE = { schemes: ['EDGE' as const], inputs: {} }
const NUMBER_INPUTS = ['roadGradeM', 'floodElevationM', 'datumOffsetM', 'projectAreaM2'] as const

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
    return await ctx.db.insert('projects', { ...args, ...NEW_PROJECT_SCOPE, createdAt: now, updatedAt: now })
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

/** Stores the selection in scheme order without repeats, so the same choice always reads the same. */
export const setSchemes = mutation({
  args: { projectId: v.id('projects'), schemes: v.array(scheme) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schemes = SCHEME_ORDER.filter((s) => args.schemes.includes(s))
    if (schemes.length === 0) throw new Error('A project measures at least one scheme')
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error('404: project not found')
    await ctx.db.patch(args.projectId, { schemes, updatedAt: Date.now() })
    return null
  },
})

/** Replaces the whole inputs object: a field the person cleared is absent, never kept from before. */
export const setInputs = mutation({
  args: { projectId: v.id('projects'), inputs: projectInputs },
  returns: v.null(),
  handler: async (ctx, args) => {
    const inputs: Infer<typeof projectInputs> = { ...args.inputs }
    for (const key of NUMBER_INPUTS) {
      const value = inputs[key]
      if (value !== undefined && !Number.isFinite(value)) throw new Error(`${key} must be a finite number`)
    }
    if (inputs.projectAreaM2 !== undefined && inputs.projectAreaM2 <= 0) throw new Error('projectAreaM2 must be positive')
    const municipality = inputs.municipality?.trim()
    if (municipality) inputs.municipality = municipality
    else delete inputs.municipality
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error('404: project not found')
    await ctx.db.patch(args.projectId, { inputs, updatedAt: Date.now() })
    return null
  },
})
