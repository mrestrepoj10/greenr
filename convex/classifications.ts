import { v, type Infer } from 'convex/values'
import { mutation, query, type MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { classificationDoc, classificationFields, elementRole } from './validators'

const classificationRow = v.object(classificationFields)
type ClassificationRow = Infer<typeof classificationRow>

async function findRow(ctx: MutationCtx, projectId: Id<'projects'>, typeKey: string) {
  return await ctx.db
    .query('classifications')
    .withIndex('by_projectId_and_typeKey', (q) => q.eq('projectId', projectId).eq('typeKey', typeKey))
    .unique()
}

/** Rule and model results. A row the user confirmed is never replaced. */
export async function upsertClassifications(ctx: MutationCtx, projectId: Id<'projects'>, rows: ClassificationRow[]) {
  const now = Date.now()
  for (const row of rows) {
    const existing = await findRow(ctx, projectId, row.typeKey)
    if (existing?.source === 'user' && row.source !== 'user') continue
    if (existing) await ctx.db.patch(existing._id, { ...row, updatedAt: now })
    else await ctx.db.insert('classifications', { projectId, ...row, updatedAt: now })
  }
}

export const listByProject = query({
  args: { projectId: v.id('projects') },
  returns: v.array(classificationDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('classifications')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .collect()
  },
})

export const confirm = mutation({
  args: { projectId: v.id('projects'), typeKey: v.string(), role: elementRole },
  returns: v.id('classifications'),
  handler: async (ctx, args) => {
    const row = {
      typeKey: args.typeKey,
      role: args.role,
      source: 'user' as const,
      confidence: 1,
      reason: 'Confirmed by the user',
      updatedAt: Date.now(),
    }
    const existing = await findRow(ctx, args.projectId, args.typeKey)
    if (existing) {
      await ctx.db.patch(existing._id, row)
      return existing._id
    }
    return await ctx.db.insert('classifications', { projectId: args.projectId, ...row })
  },
})

/** Deletes the person's answer for a type. The next run save writes the rule or model answer in its place. */
export const unconfirm = mutation({
  args: { projectId: v.id('projects'), typeKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await findRow(ctx, args.projectId, args.typeKey)
    if (existing?.source === 'user') await ctx.db.delete(existing._id)
    return null
  },
})

export const saveMany = mutation({
  args: { projectId: v.id('projects'), rows: v.array(classificationRow) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertClassifications(ctx, args.projectId, args.rows)
    return null
  },
})
