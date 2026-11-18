import { ACP_AGENTS_ENDPOINT } from './detected-agent';

export type AgentModel = { id: string; name: string; description: string | null };

export type AgentModels = { current: string; models: AgentModel[] };

export type ModelListing = { models: AgentModel[] | null; current: string | null; chosen: string | null };

export type ModelGroup = { provider: string | null; models: AgentModel[] };

const PROVIDER_SEPARATOR = '/';

const providerOf = (id: string) => (id.includes(PROVIDER_SEPARATOR) ? id.slice(0, id.indexOf(PROVIDER_SEPARATOR)) : null);

const matches = (m: AgentModel, query: string) => `${m.id} ${m.name}`.toLowerCase().includes(query);

export function groupModels(models: AgentModel[], query: string): ModelGroup[] {
  const wanted = query.trim().toLowerCase();
  const groups = new Map<string | null, AgentModel[]>();
  for (const m of models.filter((m) => matches(m, wanted))) {
    const provider = providerOf(m.id);
    groups.set(provider, [...(groups.get(provider) ?? []), m]);
  }

  return [...groups].map(([provider, list]) => ({ provider, models: list }));
}

export const agentModelsEndpoint = (agent: string) => `${ACP_AGENTS_ENDPOINT}/${encodeURIComponent(agent)}/models`;
