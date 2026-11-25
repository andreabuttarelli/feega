import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AiState, ToView, type ChatRow, type ViewMessage } from '../../messages';
import { AcpId } from './acp-agents';
import { aiChat, MAX_LIVE, type ChatRecord } from './ai-chat';
import { AgentEventKind, type OpenAgent } from './agent-session';
import { openAcpAgent } from './acp-session';
import { ItemKind } from './transcript';
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

type Options = { flags?: string[]; confirmed?: boolean; saved?: ChatRecord[]; granted?: Set<string> };

function setup({ flags = [], confirmed = true, saved = [], granted = new Set<string>() }: Options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ai-chat-'));
  writeFileSync(join(root, 'a.txt'), 'x');
  const sent: ViewMessage[] = [];
  const opened: (string | null)[] = [];
  const created: [number, number][] = [];
  const configured: [string, string][] = [];
  let stored: ChatRecord[] = saved;
  let clock = 1000;
  let ids = 0;
  const open: OpenAgent = (_launch, deps) => (opened.push(deps.resume), openAcpAgent({ command: process.execPath, args: [FAKE, ...flags] }, deps));
  const chat = aiChat({
    root: () => root,
    env: () => ({ path: ['/bin'], home: '/h', exists: (p) => p === '/bin/opencode' || p === '/bin/grok' || p === '/bin/claude', appName: '', extensions: [] }),
    open,
    confirm: async () => confirmed,
    adapters: { granted: (key) => granted.has(key), grant: (key) => void granted.add(key) },
    post: (message) => void sent.push(message),
    write: async () => undefined,
    record: async () => undefined,
    policy: { get: () => Policy.Ask, set: () => undefined },
    store: { load: () => stored, save: (records) => void (stored = records) },
    now: () => ++clock,
    newId: () => `chat-${++ids}`,
    created: (chats, live) => void created.push([chats, live]),
    configured: (category, value) => void configured.push([category, value])
  });
  const rows = (): ChatRow[] => sent.flatMap((m) => (m.kind === ToView.AiChats ? [m.chats] : [])).at(-1) ?? [];
  const snapshot = () => sent.flatMap((m) => (m.kind === ToView.AiChat ? [m] : [])).at(-1);
  const events = () => sent.flatMap((m) => (m.kind === ToView.AiEvent ? [m.event] : []));
  return { chat, sent, rows, snapshot, events, opened, created, configured, saved: () => stored, root };
}

const done = (t: ReturnType<typeof setup>, count: number) => eventually(() => t.events().filter((e) => e.kind === AgentEventKind.Done).length >= count);

const consents = (t: ReturnType<typeof setup>) => t.sent.filter((m) => m.kind === ToView.AiConsent);

describe('the adapter consent', () => {
  it('asks inside the chat and opens nothing until the user allows', async () => {
    const t = setup();

    const starting = t.chat.start(AcpId.Claude);
    await eventually(() => consents(t).length === 1);

    expect(consents(t)[0]).toMatchObject({ chat: 'chat-1', agent: AcpId.Claude, label: 'Claude Code' });
    expect(t.opened).toEqual([]);
    t.chat.consent(true);
    await starting;
    expect(t.opened).toEqual([null]);
    t.chat.close();
  });

  it('drops the chat when the user cancels', async () => {
    const t = setup();

    const starting = t.chat.start(AcpId.Claude);
    await eventually(() => consents(t).length === 1);
    t.chat.consent(false);
    await starting;

    expect(t.opened).toEqual([]);
    expect(t.rows()).toEqual([]);
  });

  it('does not ask again once allowed, even after a restart', async () => {
    const granted = new Set<string>();
    const first = setup({ granted });
    const starting = first.chat.start(AcpId.Claude);
    await eventually(() => consents(first).length === 1);
    first.chat.consent(true);
    await starting;
    first.chat.close();

    const again = setup({ granted });
    await again.chat.start(AcpId.Claude);

    expect(consents(again)).toEqual([]);
    expect(again.opened).toEqual([null]);
    again.chat.close();
  });

  it('asks again when the adapter version changes', async () => {
    const t = setup({ granted: new Set(['@agentclientprotocol/claude-agent-acp@0.1.0']) });

    const starting = t.chat.start(AcpId.Claude);
    await eventually(() => consents(t).length === 1);
    t.chat.consent(false);
    await starting;

    expect(t.opened).toEqual([]);
  });

  it('never asks for an agent that needs no adapter', async () => {
    const t = setup();

    await t.chat.start(AcpId.OpenCode);

    expect(consents(t)).toEqual([]);
    t.chat.close();
  });
});

describe('the AI chats', () => {
  it('lists a chat titled by its first prompt', async () => {
    const t = setup();
    await t.chat.start(AcpId.OpenCode);

    await t.chat.send('hello', null);
    await done(t, 1);

    expect(t.rows()).toMatchObject([{ id: 'chat-1', agent: AcpId.OpenCode, title: 'hello', running: false }]);
    t.chat.close();
  });

  it('restores the transcript after Feega is reopened', async () => {
    const first = setup();
    await first.chat.start(AcpId.OpenCode);
    await first.chat.send('hello', null);
    await done(first, 1);
    first.chat.close();

    const second = setup({ saved: first.saved() });
    second.chat.list();

    const snapshot = second.snapshot();
    expect(snapshot?.state).toBe(AiState.Ready);
    expect(snapshot?.items.map((i) => i.kind)).toEqual([ItemKind.User, ItemKind.Agent]);
    expect(second.rows()).toHaveLength(1);
  });

  it('resumes the agent session when it can load one', async () => {
    const first = setup({ flags: ['load'] });
    await first.chat.start(AcpId.OpenCode);
    await first.chat.send('hello', null);
    await done(first, 1);
    first.chat.close();

    const second = setup({ flags: ['load'], saved: first.saved() });
    second.chat.list();
    await second.chat.send('again', null);
    await done(second, 1);

    expect(second.opened).toEqual(['fake-session']);
    expect(second.snapshot()?.items.some((i) => i.kind === ItemKind.Note)).toBeFalsy();
    second.chat.close();
  });

  it('says the agent forgot when it cannot load the old session', async () => {
    const first = setup();
    await first.chat.start(AcpId.OpenCode);
    await first.chat.send('hello', null);
    await done(first, 1);
    first.chat.close();

    const second = setup({ saved: first.saved() });
    second.chat.list();
    await second.chat.send('again', null);
    await done(second, 1);

    const notes = second.snapshot()?.items.flatMap((i) => (i.kind === ItemKind.Note ? [i.text] : []));
    expect(notes).toEqual(["New session — the agent doesn't remember earlier messages"]);
    second.chat.close();
  });

  it('keeps a chat running while another one is opened', async () => {
    const t = setup();
    await t.chat.start(AcpId.OpenCode);
    void t.chat.send('wait', null);
    await eventually(() => t.rows()[0]?.running === true);

    await t.chat.start(AcpId.OpenCode);
    await t.chat.send('hello', null);
    await done(t, 1);

    expect(t.rows().map((r) => r.running)).toEqual([false, true]);
    await t.chat.open('chat-1');
    expect(t.snapshot()?.state).toBe(AiState.Busy);
    await t.chat.cancel();
    await done(t, 2);
    t.chat.close();
  });

  it('refuses a chat beyond the running limit with a clear message', async () => {
    const t = setup();
    for (let i = 0; i < MAX_LIVE; i++) {
      await t.chat.start(AcpId.OpenCode);
      void t.chat.send('wait', null);
      await eventually(() => t.rows().filter((r) => r.running).length === i + 1);
    }

    await t.chat.start(AcpId.OpenCode);

    const failed = t.events().filter((e) => e.kind === AgentEventKind.Failed).at(-1);
    expect(failed && failed.kind === AgentEventKind.Failed && failed.reason).toBe(`${MAX_LIVE} chats are already working. Stop one or wait for it to finish.`);
    expect(t.rows()).toHaveLength(MAX_LIVE);
    t.chat.close();
  });

  it('renames a chat', async () => {
    const t = setup();
    await t.chat.start(AcpId.OpenCode);

    t.chat.rename('chat-1', 'Hero spacing');

    expect(t.rows()[0].title).toBe('Hero spacing');
    expect(t.saved()[0].title).toBe('Hero spacing');
    t.chat.close();
  });

  it('deletes a chat only after the user confirms', async () => {
    const no = setup({ confirmed: false });
    await no.chat.start(AcpId.OpenCode);
    await no.chat.remove('chat-1');
    expect(no.rows()).toHaveLength(1);
    no.chat.close();

    const yes = setup();
    await yes.chat.start(AcpId.OpenCode);
    await yes.chat.remove('chat-1');
    expect(yes.rows()).toHaveLength(0);
    expect(yes.saved()).toEqual([]);
    expect(yes.snapshot()?.chat).toBeNull();
  });

  it('counts chats and live sessions without their text', async () => {
    const t = setup();

    await t.chat.start(AcpId.OpenCode);
    await t.chat.start(AcpId.OpenCode);

    expect(t.created).toEqual([[1, 1], [2, 2]]);
    t.chat.close();
  });

  const currents = (t: ReturnType<typeof setup>) => t.events().flatMap((e) => (e.kind === AgentEventKind.Config ? [e.options] : [])).at(-1)?.map((o) => o.current);

  it('shows the model and effort of the agent in the chat', async () => {
    const t = setup();

    await t.chat.start(AcpId.OpenCode);

    expect(currents(t)).toEqual(['sonnet', 'medium']);
    t.chat.close();
  });

  it('keeps the choice in the chat and reports only its category and value', async () => {
    const t = setup();
    await t.chat.start(AcpId.OpenCode);

    await t.chat.setConfig('model', 'haiku');

    expect(t.saved()[0].chosen).toEqual({ model: 'haiku' });
    expect(t.configured).toEqual([['model', 'haiku']]);
    t.chat.close();
  });

  it('restores the choice when the chat is reopened', async () => {
    const first = setup();
    await first.chat.start(AcpId.OpenCode);
    await first.chat.setConfig('effort', 'high');
    first.chat.close();

    const second = setup({ saved: first.saved() });
    second.chat.list();
    await second.chat.send('hello', null);
    await done(second, 1);

    expect(currents(second)).toEqual(['sonnet', 'high']);
    second.chat.close();
  });

  it('starts a new chat with the values last used with that agent', async () => {
    const t = setup();
    await t.chat.start(AcpId.OpenCode);
    await t.chat.setConfig('model', 'haiku');

    await t.chat.start(AcpId.OpenCode);

    expect(currents(t)).toEqual(['haiku', 'medium']);
    t.chat.close();
  });

  it('does not carry the values of one agent into another', async () => {
    const t = setup();
    await t.chat.start(AcpId.OpenCode);
    await t.chat.setConfig('model', 'haiku');

    await t.chat.start(AcpId.Grok);

    expect(currents(t)).toEqual(['sonnet', 'medium']);
    t.chat.close();
  });
});
