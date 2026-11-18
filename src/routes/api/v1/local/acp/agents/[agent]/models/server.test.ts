import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentModels } from '$lib/acp/agent-models';

const SOL_MODELS: AgentModels = { current: 'sol', models: [{ id: 'sol', name: 'Sol', description: null }, { id: 'luna', name: 'Luna', description: 'Fast' }] };

const state = vi.hoisted(() => ({ on: true, saved: {} as Record<string, string>, refreshes: [] as string[], fails: false }));

vi.mock('$lib/server/local/local-mode', () => ({
  localStore: () =>
    state.on
      ? {
          acpModel: (agent: string) => state.saved[agent] ?? null,
          chooseAcpModel: (agent: string, model: string | null) => {
            if (model === null) {
              delete state.saved[agent];
              return;
            }
            state.saved[agent] = model;
          }
        }
      : null
}));

vi.mock('$lib/server/acp/detect', async (real) => {
  const mod = await real<typeof import('$lib/server/acp/detect')>();
  return {
    ...mod,
    detectCached: async () => [
      { agent: { id: 'codex', name: 'Codex CLI' }, command: { command: 'codex-acp', args: [] } },
      { agent: { id: 'amp', name: 'Amp' }, command: { command: 'amp-acp', args: [] } },
      { agent: { id: 'goose', name: 'Goose' }, command: null }
    ]
  };
});

vi.mock('$lib/server/acp/model-cache', () => ({
  modelCache: {
    models: async (id: string, _agent: unknown, refresh: string) => {
      state.refreshes.push(refresh);
      if (state.fails) {
        throw new Error('Authentication required');
      }
      return id === 'codex' ? SOL_MODELS : null;
    }
  }
}));

const { GET, PUT } = await import('./+server');

const get = (agent: string, query = '') => GET({ params: { agent }, url: new URL(`http://x/api/v1/local/acp/agents/${agent}/models${query}`) } as never);
const put = (agent: string, body: unknown) => PUT({ params: { agent }, request: new Request(`http://x/api/v1/local/acp/agents/${agent}/models`, { method: 'PUT', body: JSON.stringify(body) }) } as never);

describe('/api/v1/local/acp/agents/[agent]/models', () => {
  beforeEach(() => {
    state.on = true;
    state.saved = {};
    state.refreshes = [];
    state.fails = false;
  });

  it('lists the models the live agent offers, its default and the saved choice', async () => {
    state.saved.codex = 'luna';

    expect(await (await get('codex')).json()).toEqual({ models: SOL_MODELS.models, current: 'sol', chosen: 'luna' });
    expect(state.refreshes).toEqual(['cached']);
  });

  it('asks the agent again on refresh', async () => {
    await get('codex', '?refresh=1');

    expect(state.refreshes).toEqual(['fresh']);
  });

  it('answers no models for an agent without a model choice', async () => {
    expect(await (await get('amp')).json()).toEqual({ models: null, current: null, chosen: null });
  });

  it('reports an agent that cannot start a session', async () => {
    state.fails = true;

    await expect(get('codex')).rejects.toMatchObject({ status: 502, body: { message: 'Authentication required' } });
  });

  it('saves a model the agent offers, and clears it with null', async () => {
    await put('codex', { model: 'luna' });
    expect(state.saved.codex).toBe('luna');

    await put('codex', { model: null });
    expect(state.saved.codex).toBeUndefined();
  });

  it('refuses a model the agent does not offer', async () => {
    await expect(put('codex', { model: 'gpt-made-up' })).rejects.toMatchObject({ status: 400 });
    await expect(put('amp', { model: 'any' })).rejects.toMatchObject({ status: 400 });
  });

  it('refuses an unknown agent and one that cannot run here', async () => {
    await expect(get('nope')).rejects.toMatchObject({ status: 404 });
    await expect(get('goose')).rejects.toMatchObject({ status: 409 });
  });

  it('is not found outside local mode', async () => {
    state.on = false;

    await expect(get('codex')).rejects.toMatchObject({ status: 404 });
  });
});
