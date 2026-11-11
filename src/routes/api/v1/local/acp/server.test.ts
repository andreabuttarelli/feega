import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const local = vi.hoisted(() => ({ on: true }));

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => (local.on ? {} : null) }));

vi.mock('$lib/server/acp/agents', async (real) => {
  const mod = await real<typeof import('$lib/server/acp/agents')>();
  const fake = { label: 'Fake', command: process.execPath, args: [fileURLToPath(new URL('../../../../../lib/server/acp/fake-agent.mjs', import.meta.url))] };
  return { ...mod, ACP_AGENTS: { ...mod.ACP_AGENTS, [mod.AcpAgent.Claude]: fake } };
});

const { POST } = await import('./+server');

const post = (body: unknown) => POST({ request: new Request('http://x/api/v1/local/acp', { method: 'POST', body: JSON.stringify(body) }) } as never);

describe('POST /api/v1/local/acp', () => {
  beforeEach(() => {
    local.on = true;
  });

  it('runs a turn on the chosen agent with the Feega MCP server', async () => {
    const res = await post({ agent: 'claude', prompt: 'add a title' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'heard: add a title', toolCalls: ['feega edit via feega (yes)'], stopReason: 'end_turn' });
  });

  it('is not found outside local mode', async () => {
    local.on = false;

    await expect(post({ agent: 'claude', prompt: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an unknown agent', async () => {
    await expect(post({ agent: 'nope', prompt: 'x' })).rejects.toMatchObject({ status: 400 });
  });
});
