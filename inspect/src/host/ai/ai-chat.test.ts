import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AdapterState, AiState, ToView, type ChatRow, type ViewMessage } from '../../messages';
import { AcpId } from './acp-agents';
import { aiChat, MAX_LIVE, type ChatRecord } from './ai-chat';
import type { Adapters } from './adapters';
import { AgentEventKind, type Launch, type OpenAgent } from './agent-session';
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

const ADAPTER_LAUNCH = { command: '/node', args: ['/adapter/index.js'], env: { ELECTRON_RUN_AS_NODE: '1' } };

type Options = { flags?: string[]; confirmed?: boolean; saved?: ChatRecord[]; ready?: AcpId[]; failing?: string };

function setup({ flags = [], confirmed = true, saved = [], ready = [], failing }: Options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ai-chat-'));
  writeFileSync(join(root, 'a.txt'), 'x');
  const sent: ViewMessage[] = [];
  const opened: (string | null)[] = [];
  const created: [number, number][] = [];
  const configured: [string, string][] = [];
  let stored: ChatRecord[] = saved;
  let clock = 1000;
  let ids = 0;
  const installs: AcpId[] = [];
  const launched: Launch[] = [];
  const present = new Set<AcpId>(ready);
  let reason = failing;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapters: Adapters = {
    ready: (id) => present.has(id),
    install: async (id) => {
      installs.push(id);
      if (reason) {
        throw new Error(reason);
      }
      await gate;
      present.add(id);
    },
    launch: () => ADAPTER_LAUNCH
  };
  const open: OpenAgent = (launch, deps) => (opened.push(deps.resume), launched.push(launch), openAcpAgent({ command: process.execPath, args: [FAKE, ...flags] }, deps));
  const chat = aiChat({
    root: () => root,
    env: () => ({ path: ['/bin'], home: '/h', exists: (p) => p === '/bin/opencode' || p === '/bin/grok' || p === '/bin/claude', appName: '', extensions: [] }),
    open,
    confirm: async () => confirmed,
    where: () => 'project: /work/app\ndev server: http://localhost:5173',
    adapters,
    post: (message) => void sent.push(message),
    write: async () => undefined,
    record: async () => undefined,
    policy: { get: () => Policy.Ask, set: () => undefined },
    store: { load: () => stored, save: (records) => void (stored = records) },
    now: () => ++clock,
    newId: () => `chat-${++ids}`,
    created: (chats, live) => void created.push([chats, live]),
    configured: (category, value) => void configured.push([category, value]),
    mcp: () => [{ name: 'feega', command: '/usr/bin/node', args: ['/ext/mcp.cjs'], env: { FEEGA_PROJECT: root } }]
  });
  const rows = (): ChatRow[] => sent.flatMap((m) => (m.kind === ToView.AiChats ? [m.chats] : [])).at(-1) ?? [];
  const snapshot = () => sent.flatMap((m) => (m.kind === ToView.AiChat ? [m] : [])).at(-1);
  const events = () => sent.flatMap((m) => (m.kind === ToView.AiEvent ? [m.event] : []));
  return { chat, sent, rows, snapshot, events, opened, created, configured, installs, launched, finish: () => release(), recover: () => ((reason = undefined), release()), saved: () => stored, root };
}

const done = (t: ReturnType<typeof setup>, count: number) => eventually(() => t.events().filter((e) => e.kind === AgentEventKind.Done).length >= count);

describe('the context the agent receives', () => {
  it('carries the page, the focused component, the project and the dev server', async () => {
    const t = setup();
    const context = ['Feega page', 'page: /pricing', 'focused component: InstallCta (src/InstallCta.svelte:12:1)'].join('\n');

    await t.chat.start(AcpId.OpenCode);
    await t.chat.send('echo', context);
    await done(t, 1);

    const reply = t.events().flatMap((e) => (e.kind === AgentEventKind.Text ? [e.text] : [])).join('');
    expect(reply).toContain('focused component: InstallCta (src/InstallCta.svelte:12:1)');
    expect(reply).toContain('page: /pricing');
    expect(reply).toContain('project: /work/app');
    expect(reply).toContain('dev server: http://localhost:5173');
    t.chat.close();
  });

  it('sends the bare message when the user removed the context', async () => {
    const t = setup();

    await t.chat.start(AcpId.OpenCode);
    await t.chat.send('echo', null);
    await done(t, 1);

    const reply = t.events().flatMap((e) => (e.kind === AgentEventKind.Text ? [e.text] : [])).join('');
    expect(reply).toBe('echo');
    t.chat.close();
  });
});

describe('what the agent can see', () => {
  const said = (t: ReturnType<typeof setup>) => t.events().flatMap((e) => (e.kind === AgentEventKind.Text ? [e.text] : [])).join('');

  it('starts the agent with the editor tools', async () => {
    const t = setup();

    await t.chat.start(AcpId.OpenCode);
    await t.chat.send('mcp', null);
    await done(t, 1);

    expect(JSON.parse(said(t))).toMatchObject([{ name: 'feega', command: '/usr/bin/node' }]);
    t.chat.close();
  });

  it('sends the screenshots with the message', async () => {
    const t = setup({ flags: ['images'] });

    await t.chat.start(AcpId.OpenCode);
    await t.chat.send('seen', null, ['iVBORw0K']);
    await done(t, 1);

    expect(said(t)).toBe('image/png:iVBORw0K');
    t.chat.close();
  });

  it('tells the panel whether the agent takes images', async () => {
    const takes = setup({ flags: ['images'] });
    const refuses = setup();

    await takes.chat.start(AcpId.OpenCode);
    await refuses.chat.start(AcpId.OpenCode);

    const imagesOf = (t: ReturnType<typeof setup>) => t.sent.flatMap((m) => (m.kind === ToView.AiState && m.state === AiState.Ready ? [m.images] : [])).at(-1);
    expect(imagesOf(takes)).toBe(true);
    expect(imagesOf(refuses)).toBe(false);
    takes.chat.close();
    refuses.chat.close();
  });

  it('keeps the screenshots out of the saved chat', async () => {
    const t = setup({ flags: ['images'] });

    await t.chat.start(AcpId.OpenCode);
    await t.chat.send('hello', null, ['iVBORw0K']);
    await done(t, 1);

    expect(JSON.stringify(t.saved())).not.toContain('iVBORw0K');
    t.chat.close();
  });
});

describe('the adapter in the chat', () => {
  it('installs a missing adapter on first open, showing Connecting, and asks nothing', async () => {
    const t = setup();

    const starting = t.chat.start(AcpId.Claude);
    await eventually(() => t.installs.length === 1);

    expect(t.sent.some((m) => m.kind === ToView.AiState && m.state === AiState.Starting)).toBe(true);
    expect(t.opened).toEqual([]);
    t.finish();
    await starting;
    expect(t.opened).toEqual([null]);
    expect(t.installs).toEqual([AcpId.Claude]);
    t.chat.close();
  });

  it('launches the installed adapter, not npx', async () => {
    const t = setup({ ready: [AcpId.Claude] });

    await t.chat.start(AcpId.Claude);

    expect(t.installs).toEqual([]);
    expect(t.launched).toEqual([ADAPTER_LAUNCH]);
    t.chat.close();
  });

  it('keeps the chat with the reason when the install fails, and connects on retry', async () => {
    const t = setup({ failing: 'Could not reach npm. Check your connection, then retry.' });

    await t.chat.start(AcpId.Claude);

    expect(t.opened).toEqual([]);
    expect(t.rows()).toMatchObject([{ id: 'chat-1', agent: AcpId.Claude }]);
    expect(t.snapshot()?.items).toEqual([{ kind: ItemKind.Error, text: 'Could not reach npm. Check your connection, then retry.' }]);

    t.recover();
    await t.chat.retry();

    expect(t.opened).toEqual([null]);
    expect(t.snapshot()?.state).toBe(AiState.Ready);
    expect(t.snapshot()?.items).toEqual([]);
    t.chat.close();
  });

  it('never installs for an agent that needs no adapter', async () => {
    const t = setup();

    await t.chat.start(AcpId.OpenCode);

    expect(t.installs).toEqual([]);
    t.chat.close();
  });
});

describe('preparing the adapters for onboarding', () => {
  const rowsOf = (t: ReturnType<typeof setup>) => t.sent.flatMap((m) => (m.kind === ToView.Adapters ? [m.rows] : []));

  it('downloads the adapter of each installed agent and reports progress', async () => {
    const t = setup();

    const preparing = t.chat.prepare();
    await eventually(() => t.installs.length === 1);
    t.finish();
    await preparing;

    const states = rowsOf(t).map((rows) => rows.map((r) => [r.agent, r.state]));
    expect(states).toEqual([[[AcpId.Claude, AdapterState.Installing]], [[AcpId.Claude, AdapterState.Ready]]]);
    expect(rowsOf(t)[0][0].label).toBe('Claude Code');
  });

  it('reports the reason when the download fails', async () => {
    const t = setup({ failing: 'offline' });

    await t.chat.prepare();

    expect(rowsOf(t).at(-1)).toEqual([{ agent: AcpId.Claude, label: 'Claude Code', state: AdapterState.Failed, reason: 'offline' }]);
  });

  it('downloads nothing that is already there', async () => {
    const t = setup({ ready: [AcpId.Claude] });

    await t.chat.prepare();

    expect(t.installs).toEqual([]);
    expect(rowsOf(t).at(-1)).toMatchObject([{ agent: AcpId.Claude, state: AdapterState.Ready }]);
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
