import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { readAcpEvents, AcpEventKind, type AcpEvent } from '$lib/acp/acp-events';

const local = vi.hoisted(() => ({ on: true }));

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => (local.on ? {} : null) }));

vi.mock('$lib/server/acp/agents', async (real) => {
  const mod = await real<typeof import('$lib/server/acp/agents')>();
  const fake = { command: process.execPath, args: [fileURLToPath(new URL('../../../../../lib/server/acp/fake-agent.mjs', import.meta.url))] };
  return { ...mod, ACP_AGENTS: { ...mod.ACP_AGENTS, [mod.AcpAgent.Claude]: fake } };
});

const { POST } = await import('./+server');

const post = (body: unknown, signal?: AbortSignal) => POST({ request: new Request('http://x/api/v1/local/acp', { method: 'POST', body: JSON.stringify(body), signal }) } as never);

async function runTurn(answer: (e: Extract<AcpEvent, { kind: AcpEventKind.Permission }>) => unknown, signal?: AbortSignal): Promise<AcpEvent[]> {
  const res = await post({ agent: 'claude', prompt: 'add a title' }, signal);
  const events: AcpEvent[] = [];
  for await (const e of readAcpEvents(res.body!)) {
    events.push(e);
    if (e.kind === AcpEventKind.Permission) {
      await post(answer(e));
    }
  }
  return events;
}

describe('POST /api/v1/local/acp', () => {
  beforeEach(() => {
    local.on = true;
  });

  it('streams the turn and waits for the user to allow the tool call', async () => {
    const events = await runTurn((e) => ({ permission: { id: e.id, optionId: 'yes' } }));

    expect(events.map((e) => e.kind)).toEqual([AcpEventKind.Update, AcpEventKind.Permission, AcpEventKind.Update, AcpEventKind.Done]);
    expect(events[1]).toMatchObject({ title: 'feega edit', options: [{ optionId: 'no' }, { optionId: 'yes' }] });
    expect(events[2]).toMatchObject({ update: { sessionUpdate: 'tool_call', title: 'feega edit via feega (yes)' } });
    expect(events[3]).toEqual({ kind: AcpEventKind.Done, stopReason: 'end_turn' });
  });

  it('passes a rejection to the agent', async () => {
    const events = await runTurn((e) => ({ permission: { id: e.id, optionId: 'no' } }));

    expect(events[2]).toMatchObject({ update: { title: 'feega edit via feega (no)' } });
  });

  it('refuses an answer to a permission nobody asked', async () => {
    await expect(post({ permission: { id: 'nope', optionId: 'yes' } })).rejects.toMatchObject({ status: 404 });
  });

  it('is not found outside local mode', async () => {
    local.on = false;

    await expect(post({ agent: 'claude', prompt: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an unknown agent', async () => {
    await expect(post({ agent: 'nope', prompt: 'x' })).rejects.toMatchObject({ status: 400 });
  });
});
