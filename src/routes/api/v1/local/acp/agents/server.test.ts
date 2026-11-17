import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcpLaunch, AgentAuth, type DetectedAgent } from '$lib/acp/detected-agent';

const CLAUDE: DetectedAgent = { id: 'claude', name: 'Claude Code', installed: true, version: '2.1.3', launch: AcpLaunch.Adapter, auth: AgentAuth.SignedIn, install: 'x', login: null };

const state = vi.hoisted(() => ({ on: true, chosen: null as string | null, refreshes: [] as string[] }));

vi.mock('$lib/server/local/local-mode', () => ({
  localStore: () => (state.on ? { acpAgent: () => state.chosen, chooseAcpAgent: (id: string | null) => (state.chosen = id) } : null)
}));

vi.mock('$lib/server/acp/detect', async (real) => {
  const mod = await real<typeof import('$lib/server/acp/detect')>();
  return {
    ...mod,
    detectCached: async (refresh: string) => {
      state.refreshes.push(refresh);
      return [{ agent: CLAUDE, command: null }];
    }
  };
});

const { GET, PUT } = await import('./+server');

const get = (query = '') => GET({ url: new URL(`http://x/api/v1/local/acp/agents${query}`) } as never);
const put = (body: unknown) => PUT({ request: new Request('http://x/api/v1/local/acp/agents', { method: 'PUT', body: JSON.stringify(body) }) } as never);

describe('/api/v1/local/acp/agents', () => {
  beforeEach(() => {
    state.on = true;
    state.chosen = null;
    state.refreshes = [];
  });

  it('lists the detected agents and the one this file chose', async () => {
    state.chosen = 'claude';

    expect(await (await get()).json()).toEqual({ agents: [CLAUDE], chosen: 'claude' });
    expect(state.refreshes).toEqual(['cached']);
  });

  it('detects again on refresh', async () => {
    await get('?refresh=1');

    expect(state.refreshes).toEqual(['fresh']);
  });

  it('remembers the choice in the file', async () => {
    await put({ agent: 'claude' });
    expect(state.chosen).toBe('claude');

    await put({ agent: null });
    expect(state.chosen).toBeNull();
  });

  it('refuses an agent outside the catalog', async () => {
    await expect(put({ agent: 'nope' })).rejects.toMatchObject({ status: 400 });
  });

  it('is not found outside local mode', async () => {
    state.on = false;

    await expect(get()).rejects.toMatchObject({ status: 404 });
  });
});
