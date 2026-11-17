import { describe, expect, it } from 'vitest';
import { AgentChoices } from './agent-choices.svelte';
import { AcpLaunch, AgentAuth, type DetectedAgent } from './detected-agent';

const CLAUDE: DetectedAgent = { id: 'claude', name: 'Claude Code', installed: true, version: '2.1.3', launch: AcpLaunch.Adapter, auth: AgentAuth.SignedIn, install: 'x', login: null };

function server(chosen: string | null, put: 'ok' | 'fail' = 'ok') {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetcher = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body as string) : undefined });
    if (method === 'PUT') {
      return new Response(null, { status: put === 'ok' ? 204 : 500 });
    }
    return Response.json({ agents: [CLAUDE], chosen });
  };
  return { calls, fetcher: fetcher as typeof fetch };
}

describe('AgentChoices', () => {
  it('loads the detected agents and the choice saved in the file', async () => {
    const choices = new AgentChoices(server('claude').fetcher);
    await choices.load();

    expect(choices.agents).toEqual([CLAUDE]);
    expect(choices.chosen).toBe('claude');
    expect(choices.current?.name).toBe('Claude Code');
  });

  it('switches at once and saves the choice in the background', async () => {
    const { calls, fetcher } = server(null);
    const choices = new AgentChoices(fetcher);
    await choices.load();

    const saved = choices.choose('claude');
    expect(choices.chosen).toBe('claude');
    await saved;

    expect(calls.at(-1)).toEqual({ url: '/api/v1/local/acp/agents', method: 'PUT', body: { agent: 'claude' } });
  });

  it('goes back to the previous choice when saving fails', async () => {
    const choices = new AgentChoices(server(null, 'fail').fetcher);
    await choices.load();

    await choices.choose('claude');

    expect(choices.chosen).toBeNull();
    expect(choices.failed).toBe(true);
  });

  it('asks the server to detect again on refresh', async () => {
    const { calls, fetcher } = server(null);
    const choices = new AgentChoices(fetcher);
    await choices.refresh();

    expect(calls.at(-1)?.url).toBe('/api/v1/local/acp/agents?refresh=1');
  });
});
