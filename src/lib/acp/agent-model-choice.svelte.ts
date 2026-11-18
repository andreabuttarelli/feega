import { agentModelsEndpoint, type AgentModel, type ModelListing } from './agent-models';

const REFRESH = '?refresh=1';

export class AgentModelChoice {
  models = $state<AgentModel[]>([]);
  selected = $state<string | null>(null);
  failed = $state(false);

  private agent: string | null = null;

  constructor(private fetcher: typeof fetch = fetch) {}

  load(agent: string | null) {
    this.agent = agent;
    this.models = [];
    this.selected = null;
    return this.read(agent, '');
  }

  refresh() {
    return this.read(this.agent, REFRESH);
  }

  private async read(agent: string | null, query: string) {
    if (!agent) {
      return;
    }

    const res = await this.fetcher(`${agentModelsEndpoint(agent)}${query}`).catch(() => null);
    if (!res?.ok || this.agent !== agent) {
      return;
    }

    const listing = (await res.json()) as ModelListing;
    this.models = listing.models ?? [];
    this.selected = listing.chosen ?? listing.current;
  }

  async choose(model: string) {
    const agent = this.agent;
    if (!agent) {
      return;
    }

    const before = this.selected;
    this.selected = model;
    this.failed = false;

    const res = await this.fetcher(agentModelsEndpoint(agent), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model }) }).catch(() => null);
    if (res?.ok) {
      return;
    }

    this.selected = before;
    this.failed = true;
  }
}
