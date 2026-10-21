import { v, type Infer } from 'convex/values'
import { mutation, query, type MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { exclusionDoc, exclusionFields, exclusionStatus } from './validators'

const exclusionRow = v.object(exclusionFields)
type ExclusionRow = Infer<typeof exclusionRow>

async function findRow(ctx: MutationCtx, projectId: Id<'projects'>, id: string) {
  return await ctx.db
    .query('exclusions')
    .withIndex('by_projectId_and_id', (q) => q.eq('projectId', projectId).eq('id', id))
    .unique()
}

/** Proposals from rules or the agent. A row the user already decided keeps its status. */
export async function upsertProposedExclusions(ctx: MutationCtx, projectId: Id<'projects'>, rows: ExclusionRow[]) {
  const now = Date.now()
  for (const row of rows) {
    const existing = await findRow(ctx, projectId, row.id)
    if (existing && existing.status !== 'proposed') continue
    if (existing) await ctx.db.patch(existing._id, { ...row, updatedAt: now })
    else await ctx.db.insert('exclusions', { projectId, ...row, updatedAt: now })
  }
}

export const listByProject = query({
  args: { projectId: v.id('projects') },
  returns: v.array(exclusionDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('exclusions')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .collect()
  },
})

/** Accept, reject, or undo either by setting the status back to proposed. */
export const decide = mutation({
  args: { projectId: v.id('projects'), id: v.string(), status: exclusionStatus },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await findRow(ctx, args.projectId, args.id)
    if (!existing) throw new Error(`404: exclusion ${args.id} not found`)
    await ctx.db.patch(existing._id, { status: args.status, updatedAt: Date.now() })
    return null
  },
})

export const saveProposed = mutation({
  args: { projectId: v.id('projects'), rows: v.array(exclusionRow) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertProposedExclusions(ctx, args.projectId, args.rows)
    return null
  },
})
