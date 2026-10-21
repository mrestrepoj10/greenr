import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { classificationFields, exclusionFields, projectFields, runElementFields, runFields } from './validators'

export default defineSchema({
  projects: defineTable({
    ...projectFields,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_slug', ['slug']),

  runs: defineTable({
    projectId: v.id('projects'),
    ...runFields,
  })
    .index('by_projectId_and_computedAt', ['projectId', 'computedAt'])
    .index('by_projectId_and_runId', ['projectId', 'runId']),

  runElements: defineTable({
    runId: v.id('runs'),
    ...runElementFields,
  }).index('by_runId', ['runId']),

  classifications: defineTable({
    projectId: v.id('projects'),
    updatedAt: v.number(),
    ...classificationFields,
  })
    .index('by_projectId', ['projectId'])
    .index('by_projectId_and_typeKey', ['projectId', 'typeKey']),

  exclusions: defineTable({
    projectId: v.id('projects'),
    updatedAt: v.number(),
    ...exclusionFields,
  })
    .index('by_projectId', ['projectId'])
    .index('by_projectId_and_id', ['projectId', 'id']),

  packs: defineTable({
    runId: v.id('runs'),
    projectId: v.id('projects'),
    url: v.string(),
    size: v.number(),
    manifest: v.any(),
    createdAt: v.number(),
  }).index('by_runId', ['runId']),
}, { schemaValidation: false })
