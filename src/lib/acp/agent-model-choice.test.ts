import { describe, expect, it } from 'vitest';
import { AgentModelChoice } from './agent-model-choice.svelte';
import type { ModelListing } from './agent-models';

const LISTING: ModelListing = { models: [{ id: 'sol', name: 'Sol', description: null }, { id: 'luna', name: 'Luna', description: 'Fast' }], current: 'sol', chosen: null };

function server(listing: ModelListing | 'fail', put: 'ok' | 'fail' = 'ok') {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetcher = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body as string) : undefined });
    if (method === 'PUT') {
      return new Response(null, { status: put === 'ok' ? 204 : 500 });
    }
    return listing === 'fail' ? new Response('no', { status: 502 }) : Response.json(listing);
  };
  return { calls, fetcher: fetcher as typeof fetch };
}

describe('AgentModelChoice', () => {
  it('loads the live models of the agent and shows its default when nothing is saved', async () => {
    const { calls, fetcher } = server(LISTING);
    const choice = new AgentModelChoice(fetcher);
    await choice.load('codex');

    expect(calls[0].url).toBe('/api/v1/local/acp/agents/codex/models');
    expect(choice.models.map((m) => m.id)).toEqual(['sol', 'luna']);
    expect(choice.selected).toBe('sol');
  });

  it('shows the saved model over the default', async () => {
    const choice = new AgentModelChoice(server({ ...LISTING, chosen: 'luna' }).fetcher);
    await choice.load('codex');

    expect(choice.selected).toBe('luna');
  });

  it('offers nothing for an agent without models or one that failed to answer', async () => {
    const without = new AgentModelChoice(server({ models: null, current: null, chosen: null }).fetcher);
    await without.load('amp');
    expect(without.models).toEqual([]);

    const failed = new AgentModelChoice(server('fail').fetcher);
    await failed.load('cursor');
    expect(failed.models).toEqual([]);
  });

  it('forgets the models when no agent is picked', async () => {
    const choice = new AgentModelChoice(server(LISTING).fetcher);
    await choice.load('codex');
    await choice.load(null);

    expect(choice.models).toEqual([]);
  });

  it('switches at once and saves the model in the background', async () => {
    const { calls, fetcher } = server(LISTING);
    const choice = new AgentModelChoice(fetcher);
    await choice.load('codex');

    const saved = choice.choose('luna');
    expect(choice.selected).toBe('luna');
    await saved;

    expect(calls.at(-1)).toEqual({ url: '/api/v1/local/acp/agents/codex/models', method: 'PUT', body: { model: 'luna' } });
  });

  it('goes back to the previous model when the save fails', async () => {
    const choice = new AgentModelChoice(server(LISTING, 'fail').fetcher);
    await choice.load('codex');
    await choice.choose('luna');

    expect(choice.selected).toBe('sol');
    expect(choice.failed).toBe(true);
  });
});
