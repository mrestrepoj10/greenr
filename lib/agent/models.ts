/** The models the gateway proxy accepts. The first is the default. */
export const AGENT_MODELS = [
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5' },
  { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol' },
] as const

export type AgentModelId = (typeof AGENT_MODELS)[number]['id']

export const DEFAULT_AGENT_MODEL: AgentModelId = AGENT_MODELS[0].id

export const isAgentModel = (id: string | null | undefined): id is AgentModelId =>
  AGENT_MODELS.some((model) => model.id === id)

export const GATEWAY_BASE = '/api/agent/gateway'
