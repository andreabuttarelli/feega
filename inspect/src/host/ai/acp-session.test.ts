import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentEventKind, type AgentEvent, type AgentSession } from './agent-session';
import { openAcpAgent } from './acp-session';
import { Policy } from './permission-policy';

const FAKE = fileURLToPath(new URL('./fake-acp-agent.mjs', import.meta.url));
const WAIT_MS = 5000;

const eventually = async (check: () => boolean) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > WAIT_MS) {
      throw new Error('timed out');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const open = async (policy = Policy.Ask) => {
  const dir = mkdtempSync(join(tmpdir(), 'acp-'));
  const events: AgentEvent[] = [];
  const written: Record<string, string> = {};
  const session = await openAcpAgent(
    { command: process.execPath, args: [FAKE] },
    {
      cwd: dir,
      policy: () => policy,
      emit: (event) => events.push(event),
      files: {
        read: async (path) => readFileSync(path, 'utf8'),
        write: async (path, content) => void (written[path] = content)
      }
    }
  );
  return { dir, events, written, session };
};

const sessions: AgentSession[] = [];

afterEach(() => sessions.splice(0).forEach((s) => s.close()));

describe('the ACP session', () => {
  it('streams the reply text then reports the turn done', async () => {
    const { events, session } = await open();
    sessions.push(session);

    await session.send('hello');

    const text = events.flatMap((e) => (e.kind === AgentEventKind.Text ? [e.text] : [])).join('');
    expect(text).toBe('Hello');
    expect(events.at(-1)).toEqual({ kind: AgentEventKind.Done, reason: 'end_turn' });
  });

  it('asks before a write and lands it through the editor when allowed', async () => {
    const { dir, events, written, session } = await open();
    sessions.push(session);
    const target = join(dir, 'a.txt');

    const turn = session.send(`write ${target}`);
    await eventually(() => events.some((e) => e.kind === AgentEventKind.Permission));
    const ask = events.find((e) => e.kind === AgentEventKind.Permission)!;
    expect(ask.kind === AgentEventKind.Permission && ask.tool.diffs[0].path).toBe(target);
    expect(written).toEqual({});

    if (ask.kind === AgentEventKind.Permission) {
      session.answer(ask.id, ask.options.find((o) => o.allows)!.id);
    }
    await turn;

    expect(written[target]).toBe('written by the agent\n');
  });

  it('writes nothing when the permission is rejected', async () => {
    const { dir, events, written, session } = await open();
    sessions.push(session);

    const turn = session.send(`write ${join(dir, 'a.txt')}`);
    await eventually(() => events.some((e) => e.kind === AgentEventKind.Permission));
    const ask = events.find((e) => e.kind === AgentEventKind.Permission)!;
    if (ask.kind === AgentEventKind.Permission) {
      session.answer(ask.id, ask.options.find((o) => !o.allows)!.id);
    }
    await turn;

    expect(written).toEqual({});
    expect(events.some((e) => e.kind === AgentEventKind.Text && e.text === 'denied')).toBe(true);
  });

  it('serves file reads from the editor', async () => {
    const { dir, events, session } = await open();
    sessions.push(session);
    const file = join(dir, 'in.txt');
    writeFileSync(file, 'from disk');

    await session.send(`read ${file}`);

    expect(events.some((e) => e.kind === AgentEventKind.Text && e.text === 'from disk')).toBe(true);
  });

  it('cancels a running turn', async () => {
    const { events, session } = await open();
    sessions.push(session);

    const turn = session.send('wait');
    await new Promise((resolve) => setTimeout(resolve, 100));
    await session.cancel();
    await turn;

    expect(events.at(-1)).toEqual({ kind: AgentEventKind.Done, reason: 'cancelled' });
  });

  it('reports the plan', async () => {
    const { events, session } = await open();
    sessions.push(session);

    await session.send('plan');

    expect(events.find((e) => e.kind === AgentEventKind.Plan)).toEqual({ kind: AgentEventKind.Plan, entries: [{ content: 'step one', status: 'in_progress' }] });
  });

  it('reports the modes the agent advertises', async () => {
    const { events, session } = await open();
    sessions.push(session);

    const modes = events.find((e) => e.kind === AgentEventKind.Modes);

    expect(modes).toMatchObject({ current: 'default', available: [{ id: 'default', name: 'Default' }, { id: 'acceptEdits' }, { id: 'plan', description: 'Plan without editing' }] });
  });

  it('switches the agent mode and reports it', async () => {
    const { events, session } = await open();
    sessions.push(session);

    await session.setMode('plan');
    await eventually(() => events.filter((e) => e.kind === AgentEventKind.Modes).length > 1);

    expect(events.filter((e) => e.kind === AgentEventKind.Modes).at(-1)).toMatchObject({ current: 'plan' });
  });

  it('answers a write itself when the policy allows edits', async () => {
    const { dir, events, written, session } = await open(Policy.Edits);
    sessions.push(session);
    const target = join(dir, 'a.txt');

    await session.send(`write ${target}`);

    expect(events.some((e) => e.kind === AgentEventKind.Permission)).toBe(false);
    expect(written[target]).toBe('written by the agent\n');
  });

  it('still asks for a write when the policy is Ask every time', async () => {
    const { dir, events, session } = await open(Policy.Ask);
    sessions.push(session);

    void session.send(`write ${join(dir, 'a.txt')}`);
    await eventually(() => events.some((e) => e.kind === AgentEventKind.Permission));
  });
});
