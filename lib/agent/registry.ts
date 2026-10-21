import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolSchema } from '@/lib/agent-types'

/** The JSON Schema subset greenr's tools declare. Unlike the viewer kit's, items may be objects. */
export type JsonSchema =
  | { type: 'string'; description?: string; enum?: readonly string[]; maxLength?: number }
  | { type: 'number' | 'integer'; description?: string; minimum?: number; maximum?: number }
  | { type: 'boolean'; description?: string }
  | { type: 'array'; description?: string; items: JsonSchema; minItems?: number; maxItems?: number }
  | ObjectSchema

export type ObjectSchema = {
  type: 'object'
  description?: string
  properties: Record<string, JsonSchema>
  required?: readonly string[]
  additionalProperties: false
}

export type ToolArgs = Record<string, unknown>

/** One tool the agent can call, for the chat panel and the dev terminal alike. */
export type ToolSpec = {
  name: string
  /** Model-facing: what the tool does and when to reach for it. */
  description: string
  parameters: ObjectSchema
  /** Safe to run again with the same input: it reads, or it converges to the same state. */
  idempotent: boolean
  /** Changes what the viewer shows or what the run holds. */
  mutates: boolean
  run(args: ToolArgs, context: AgentToolContext): Promise<AgentToolResult>
}

export type AgentTools = {
  readonly specs: readonly ToolSpec[]
  get(name: string): ToolSpec | undefined
  /** The shape the libfx preset runs. Every call is checked against the tool's parameters first. */
  asAgentTools(): AgentTool[]
}

/** Returns the first way `value` breaks `schema`, or null when it fits. */
export function violation(schema: JsonSchema, value: unknown, path = 'input'): string | null {
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') return `${path} must be a string`
      if (schema.enum && !schema.enum.includes(value)) return `${path} must be one of ${schema.enum.join(', ')}`
      if (schema.maxLength !== undefined && value.length > schema.maxLength) return `${path} is longer than ${schema.maxLength}`
      return null
    case 'number':
    case 'integer':
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${path} must be a number`
      if (schema.type === 'integer' && !Number.isInteger(value)) return `${path} must be an integer`
      if (schema.minimum !== undefined && value < schema.minimum) return `${path} must be at least ${schema.minimum}`
      if (schema.maximum !== undefined && value > schema.maximum) return `${path} must be at most ${schema.maximum}`
      return null
    case 'boolean':
      return typeof value === 'boolean' ? null : `${path} must be true or false`
    case 'array': {
      if (!Array.isArray(value)) return `${path} must be an array`
      if (schema.minItems !== undefined && value.length < schema.minItems) return `${path} needs at least ${schema.minItems} items`
      if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${path} takes at most ${schema.maxItems} items`
      for (let i = 0; i < value.length; i++) {
        const problem = violation(schema.items, value[i], `${path}[${i}]`)
        if (problem) return problem
      }
      return null
    }
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${path} must be an object`
      const record = value as Record<string, unknown>
      for (const key of schema.required ?? []) if (record[key] === undefined) return `${path}.${key} is required`
      for (const [key, item] of Object.entries(record)) {
        const property = schema.properties[key]
        if (!property) return `${path}.${key} is not a parameter of this tool`
        if (item === undefined) continue
        const problem = violation(property, item, `${path}.${key}`)
        if (problem) return problem
      }
      return null
    }
  }
}

export function createAgentTools(specs: readonly ToolSpec[]): AgentTools {
  const byName = new Map(specs.map((spec) => [spec.name, spec]))
  return {
    specs,
    get: (name) => byName.get(name),
    asAgentTools: () =>
      specs.map((spec) => ({
        name: spec.name,
        description: spec.description,
        // The kit's type stops at flat arrays; the runtime passes any JSON Schema through to the model.
        inputSchema: spec.parameters as unknown as AgentToolSchema,
        mutates: spec.mutates,
        execute: async (input, context) => {
          const args = input ?? {}
          const problem = violation(spec.parameters, args)
          if (problem) throw new Error(`${spec.name}: ${problem}`)
          return spec.run(args as ToolArgs, context)
        },
      })),
  }
}

/** A viewer kit tool joins the registry as is: it validates its own input, and a read is safe to repeat. */
export function fromKitTool(tool: AgentTool): ToolSpec {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema as unknown as ObjectSchema,
    idempotent: !tool.mutates,
    mutates: tool.mutates,
    run: (args, context) => tool.execute(args, context),
  }
}
