import { ACP_AGENTS_ENDPOINT } from './detected-agent';

export type AgentModel = { id: string; name: string; description: string | null };

export type AgentModels = { current: string; models: AgentModel[] };

export type ModelListing = { models: AgentModel[] | null; current: string | null; chosen: string | null };

export const agentModelsEndpoint = (agent: string) => `${ACP_AGENTS_ENDPOINT}/${encodeURIComponent(agent)}/models`;
