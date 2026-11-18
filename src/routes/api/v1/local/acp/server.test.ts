import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { readAcpEvents, AcpEventKind, type AcpEvent } from '$lib/acp/acp-events';

const local = vi.hoisted(() => ({ on: true }));
const cancelLog = vi.hoisted(() => ({ path: '' }));

vi.mock('$lib/server/local/local-mode', () => ({
  localStore: () => (local.on ? { acpModel: (agent: string) => (agent === 'codex' ? 'deep' : null), acpEffort: (agent: string) => (agent === 'codex' ? 'max' : null) } : null)
}));

vi.mock('$lib/server/acp/detect', async (real) => {
  const mod = await real<typeof import('$lib/server/acp/detect')>();
  const fake = { command: process.execPath, args: [fileURLToPath(new URL('../../../../../lib/server/acp/fake-agent.mjs', import.meta.url))] };
  return {
    ...mod,
    detectCached: async () => [
      { agent: { id: 'claude' }, command: fake },
      { agent: { id: 'codex' }, command: { ...fake, env: { FAKE_ACP_MODELS: 'effort' } } },
      { agent: { id: 'chatty' }, command: { ...fake, env: { FAKE_ACP_CHATTY: '1', FAKE_ACP_LOG: cancelLog.path } } },
      { agent: { id: 'goose' }, command: null }
    ]
  };
});

const { POST } = await import('./+server');

const post = (body: unknown, signal?: AbortSignal) => POST({ request: new Request('http://x/api/v1/local/acp', { method: 'POST', body: JSON.stringify(body), signal }) } as never);

async function runTurn(answer: (e: Extract<AcpEvent, { kind: AcpEventKind.Permission }>) => unknown, signal?: AbortSignal, agent = 'claude'): Promise<AcpEvent[]> {
  const res = await post({ thread: crypto.randomUUID(), agent, prompt: 'add a title' }, signal);
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

    expect(events.map((e) => e.kind)).toEqual([AcpEventKind.Starting, AcpEventKind.Update, AcpEventKind.Permission, AcpEventKind.Update, AcpEventKind.Done]);
    events.shift();
    expect(events[1]).toMatchObject({ title: 'feega edit', options: [{ optionId: 'no' }, { optionId: 'yes' }] });
    expect(events[2]).toMatchObject({ update: { sessionUpdate: 'tool_call', title: 'feega edit via feega (yes)' } });
    expect(events[3]).toEqual({ kind: AcpEventKind.Done, stopReason: 'end_turn' });
  });

  it('runs the turn on the model and effort this file saved for the agent', async () => {
    const events = (await runTurn((e) => ({ permission: { id: e.id, optionId: 'yes' } }), undefined, 'codex')).slice(1);

    expect(events[0]).toMatchObject({ update: { content: { text: 'heard: add a title on deep/max' } } });
  });

  it('passes a rejection to the agent', async () => {
    const events = (await runTurn((e) => ({ permission: { id: e.id, optionId: 'no' } }))).slice(1);

    expect(events[2]).toMatchObject({ update: { title: 'feega edit via feega (no)' } });
  });

  it('refuses an answer to a permission nobody asked', async () => {
    await expect(post({ permission: { id: 'nope', optionId: 'yes' } })).rejects.toMatchObject({ status: 404 });
  });

  it('is not found outside local mode', async () => {
    local.on = false;

    await expect(post({ thread: 't', agent: 'claude', prompt: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an unknown agent', async () => {
    await expect(post({ thread: 't', agent: 'nope', prompt: 'x' })).rejects.toMatchObject({ status: 400 });
  });

  it('refuses an agent that is not installed or cannot speak ACP here', async () => {
    await expect(post({ thread: 't', agent: 'goose', prompt: 'x' })).rejects.toMatchObject({ status: 409 });
  });

  it('refuses a turn without a chat thread', async () => {
    await expect(post({ agent: 'claude', prompt: 'x' })).rejects.toMatchObject({ status: 400 });
  });

  it('starts the agent once per thread and says so only then', async () => {
    const thread = crypto.randomUUID();
    const kinds = async () => {
      const res = await post({ thread, agent: 'claude', prompt: 'x' });
      const seen: AcpEventKind[] = [];
      for await (const e of readAcpEvents(res.body!)) {
        seen.push(e.kind);
        if (e.kind === AcpEventKind.Permission) {
          await post({ permission: { id: e.id, optionId: 'yes' } });
        }
      }
      return seen;
    };

    expect((await kinds())[0]).toBe(AcpEventKind.Starting);
    expect(await kinds()).not.toContain(AcpEventKind.Starting);
  });

  it('stops the turn of a thread on request, and the turn ends as cancelled', async () => {
    const thread = crypto.randomUUID();
    const res = await post({ thread, agent: 'chatty', prompt: 'go' });
    const events: AcpEvent[] = [];
    for await (const e of readAcpEvents(res.body!)) {
      events.push(e);
      if (e.kind === AcpEventKind.Update && events.length === 2) {
        expect((await post({ cancel: thread })).status).toBe(204);
      }
    }

    expect(events.at(-1)).toEqual({ kind: AcpEventKind.Done, stopReason: 'cancelled' });
  });

  it('says there is nothing to stop when the thread is idle', async () => {
    await expect(post({ cancel: crypto.randomUUID() })).rejects.toMatchObject({ status: 404 });
  });

  it('survives the browser closing the stream mid-turn: cancels the agent and keeps serving', async () => {
    cancelLog.path = join(mkdtempSync(join(tmpdir(), 'acp-')), 'log');
    const res = await post({ thread: crypto.randomUUID(), agent: 'chatty', prompt: 'go' });
    const reader = res.body!.getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();

    await vi.waitFor(() => expect(existsSync(cancelLog.path) && readFileSync(cancelLog.path, 'utf8')).toContain('cancel'), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 100));
    await expect(post({ thread: 't', agent: 'nope', prompt: 'x' })).rejects.toMatchObject({ status: 400 });
  });
});
