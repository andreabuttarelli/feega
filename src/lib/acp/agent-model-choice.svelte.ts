import { agentModelsEndpoint, type AgentModel, type ModelListing } from './agent-models';

const REFRESH = '?refresh=1';

export class AgentModelChoice {
  models = $state<AgentModel[]>([]);
  selected = $state<string | null>(null);
  effort = $state<string | null>(null);
  failed = $state(false);

  efforts = $derived(this.models.find((m) => m.id === this.selected)?.efforts ?? []);

  private agent: string | null = null;

  constructor(private fetcher: typeof fetch = fetch) {}

  load(agent: string | null) {
    this.agent = agent;
    this.models = [];
    this.selected = null;
    this.effort = null;
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
    this.effort = listing.chosenEffort ?? listing.effort ?? null;
  }

  async choose(model: string) {
    const before = this.selected;
    this.selected = model;
    if (!(await this.save({ model }))) {
      this.selected = before;
    }
  }

  async chooseEffort(effort: string) {
    const before = this.effort;
    this.effort = effort;
    if (!(await this.save({ effort }))) {
      this.effort = before;
    }
  }

  private async save(choice: { model: string } | { effort: string }): Promise<boolean> {
    const agent = this.agent;
    if (!agent) {
      return false;
    }

    this.failed = false;
    const res = await this.fetcher(agentModelsEndpoint(agent), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(choice) }).catch(() => null);
    this.failed = !res?.ok;
    return !this.failed;
  }
}
