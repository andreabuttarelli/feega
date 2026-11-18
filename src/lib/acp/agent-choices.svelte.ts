import { ACP_AGENTS_ENDPOINT, type DetectedAgent } from './detected-agent';

type Listing = { agents: DetectedAgent[]; chosen: string | null };

export class AgentChoices {
  agents = $state<DetectedAgent[]>([]);
  chosen = $state<string | null>(null);
  refreshing = $state(false);
  failed = $state(false);

  current = $derived(this.agents.find((a) => a.id === this.chosen) ?? null);

  constructor(private fetcher: typeof fetch = fetch) {}

  load() {
    return this.read(ACP_AGENTS_ENDPOINT);
  }

  async refresh() {
    this.refreshing = true;
    await this.read(`${ACP_AGENTS_ENDPOINT}?refresh=1`);
    this.refreshing = false;
  }

  async choose(id: string | null) {
    const before = this.chosen;
    this.chosen = id;
    this.failed = false;

    const res = await this.fetcher(ACP_AGENTS_ENDPOINT, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: id }) }).catch(() => null);
    if (res?.ok) {
      return;
    }

    this.chosen = before;
    this.failed = true;
  }

  private async read(url: string) {
    const res = await this.fetcher(url).catch(() => null);
    if (!res?.ok) {
      this.failed = true;
      return;
    }

    const listing = (await res.json()) as Listing;
    this.agents = listing.agents;
    this.chosen = listing.chosen;
  }
}
