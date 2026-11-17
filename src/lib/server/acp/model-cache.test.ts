import { describe, expect, it } from 'vitest';
import type { AgentModels } from '$lib/acp/agent-models';
import { Refresh } from './detect';
import { createModelCache } from './model-cache';

const CODEX = { command: 'codex-acp', args: [] };
const LISTED: AgentModels = { current: 'sol', models: [{ id: 'sol', name: 'Sol', description: null }] };

function counting(answers: (AgentModels | null | Error)[]) {
  const calls: string[] = [];
  const list = async (agent: { command: string }) => {
    calls.push(agent.command);
    const next = answers.shift() ?? null;
    if (next instanceof Error) {
      throw next;
    }
    return next;
  };
  return { calls, cache: createModelCache(list, '/tmp') };
}

describe('model cache', () => {
  it('asks the live agent once and reuses the answer', async () => {
    const { calls, cache } = counting([LISTED]);

    expect(await cache.models('codex', CODEX, Refresh.Cached)).toEqual(LISTED);
    expect(await cache.models('codex', CODEX, Refresh.Cached)).toEqual(LISTED);
    expect(calls).toEqual(['codex-acp']);
  });

  it('asks again on refresh', async () => {
    const { calls, cache } = counting([LISTED, null]);
    await cache.models('codex', CODEX, Refresh.Cached);

    expect(await cache.models('codex', CODEX, Refresh.Fresh)).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('forgets a failed listing so the next read tries again', async () => {
    const { calls, cache } = counting([new Error('Authentication required'), LISTED]);

    await expect(cache.models('cursor', CODEX, Refresh.Cached)).rejects.toThrow('Authentication required');
    expect(await cache.models('cursor', CODEX, Refresh.Cached)).toEqual(LISTED);
    expect(calls).toHaveLength(2);
  });
});
