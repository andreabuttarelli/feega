import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AiState, ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';
import { AcpId } from './ai/acp-agents';
import { AgentEventKind, type OpenAgent } from './ai/agent-session';
import { openAcpAgent } from './ai/acp-session';
import type { AgentEnv } from './agents';

const FAKE = fileURLToPath(new URL('./ai/fake-acp-agent.mjs', import.meta.url));
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

function setup(installed: string[] = ['/bin/opencode'], confirmed = true) {
  const dir = mkdtempSync(join(tmpdir(), 'feega-session-ai-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'package.json'), '{}');
  writeFileSync(join(dir, 'src/Page.svelte'), '<h1>Hi</h1>\n');
  const sent: ViewMessage[] = [];
  const asked: string[] = [];
  let handle: (message: HostMessage) => unknown = () => undefined;
  const env: AgentEnv = { path: ['/bin'], home: '/home/none', exists: (p) => installed.includes(p), appName: '', extensions: [] };
  const open: OpenAgent = (_launch, deps) => openAcpAgent({ command: process.execPath, args: [FAKE] }, deps);
  const platform = {
    version: '1',
    launcher: '/ext/dist/launcher',
    send: (message: ViewMessage) => void sent.push(message),
    receive: (h: (message: HostMessage) => unknown) => void (handle = h),
    settings: () => ({}),
    stored: () => undefined,
    store: async () => undefined,
    log: () => undefined,
    confirm: async (question: string) => (asked.push(question), confirmed),
    account: memoryAccountStore(),
    onboarding: memoryOnboardingStore(),
    ai: { env: () => env, open }
  } as unknown as Platform;
  const session = inspectSession(platform, dir);
  const events = () => sent.flatMap((m) => (m.kind === ToView.AiEvent ? [m.event] : []));
  const states = () => sent.flatMap((m) => (m.kind === ToView.AiState ? [m.state] : []));
  return { dir, session, send: (m: HostMessage) => handle(m), sent, events, states, asked, read: (p: string) => readFileSync(join(dir, p), 'utf8'), exists: (p: string) => existsSync(join(dir, p)), changes: () => (sent.flatMap((m) => (m.kind === ToView.History ? [m.changes] : [])).at(-1) ?? []) };
}

describe('the AI panel in the session', () => {
  it('lists the agents with the installed ones marked', async () => {
    const { send, sent } = setup();

    await send({ kind: ToHost.AiList });

    const listed = sent.find((m) => m.kind === ToView.AiAgents);
    expect(listed && listed.kind === ToView.AiAgents && listed.agents.filter((a) => a.installed).map((a) => a.id)).toEqual([AcpId.OpenCode]);
  });

  it('opens the agent, streams a reply and returns to ready', async () => {
    const { send, events, states, session } = setup();

    await send({ kind: ToHost.AiStart, agent: AcpId.OpenCode });
    await send({ kind: ToHost.AiSend, text: 'hello', context: null, images: [] });
    await eventually(() => events().some((e) => e.kind === AgentEventKind.Done));

    expect(events().filter((e) => e.kind === AgentEventKind.Text).map((e) => (e.kind === AgentEventKind.Text ? e.text : '')).join('')).toBe('Hello');
    expect(states()).toEqual([AiState.Starting, AiState.Ready, AiState.Busy, AiState.Ready]);
    await session.stop();
  });

  it('puts the selection context before the question', async () => {
    const { send, events, session, dir } = setup();
    writeFileSync(join(dir, 'ctx.txt'), 'x');

    await send({ kind: ToHost.AiStart, agent: AcpId.OpenCode });
    await send({ kind: ToHost.AiSend, text: 'read ctx.txt', context: `Feega selection\nsource: src/Page.svelte:1:1`, images: [] });
    await eventually(() => events().some((e) => e.kind === AgentEventKind.Done || e.kind === AgentEventKind.Failed));

    expect(events().some((e) => e.kind === AgentEventKind.Text && e.text === 'x')).toBe(true);
    await session.stop();
  });

  it('asks, then writes through the edit history so the change is listed and undoable', async () => {
    const { send, events, sent, session, read } = setup();
    await send({ kind: ToHost.AiStart, agent: AcpId.OpenCode });

    await send({ kind: ToHost.AiSend, text: 'write src/Page.svelte', context: null, images: [] });
    await eventually(() => events().some((e) => e.kind === AgentEventKind.Permission));
    const ask = events().find((e) => e.kind === AgentEventKind.Permission)!;
    expect(read('src/Page.svelte')).toBe('<h1>Hi</h1>\n');
    await send({ kind: ToHost.AiAnswer, id: ask.kind === AgentEventKind.Permission ? ask.id : '', optionId: 'allow' });
    await eventually(() => events().some((e) => e.kind === AgentEventKind.Done));

    expect(read('src/Page.svelte')).toBe('written by the agent\n');
    const histories = sent.flatMap((m) => (m.kind === ToView.History ? [m.changes] : []));
    expect(histories.at(-1)).toMatchObject([{ prop: 'agent', value: 'OpenCode', files: ['src/Page.svelte'] }]);
    await session.stop();
  });

  it('tells the agent the project and the page it is looking at', async () => {
    const { send, sent, dir, session } = setup();

    await send({ kind: ToHost.AiStart, agent: AcpId.OpenCode });
    await send({ kind: ToHost.AiSend, text: 'echo', context: 'Feega page\npage: /pricing', images: [] });
    await eventually(() => sent.some((m) => m.kind === ToView.AiEvent && m.event.kind === AgentEventKind.Done));

    const reply = sent.flatMap((m) => (m.kind === ToView.AiEvent && m.event.kind === AgentEventKind.Text ? [m.event.text] : [])).join('');
    expect(reply).toContain('page: /pricing');
    expect(reply).toContain(`project: ${dir}`);
    await session.stop();
  });

  it('starts the agent with the Feega tools of this project', async () => {
    const { send, sent, dir, session } = setup();

    await send({ kind: ToHost.AiStart, agent: AcpId.OpenCode });
    await send({ kind: ToHost.AiSend, text: 'mcp', context: null, images: [] });
    await eventually(() => sent.some((m) => m.kind === ToView.AiEvent && m.event.kind === AgentEventKind.Done));

    const reply = sent.flatMap((m) => (m.kind === ToView.AiEvent && m.event.kind === AgentEventKind.Text ? [m.event.text] : [])).join('');
    expect(JSON.parse(reply)).toEqual([{ name: 'feega', command: process.execPath, args: ['/ext/dist/launcher/mcp.cjs'], env: expect.arrayContaining([{ name: 'FEEGA_PROJECT', value: dir }, { name: 'ELECTRON_RUN_AS_NODE', value: '1' }]) }]);
    await session.stop();
  });

  it('refuses an agent that is not installed', async () => {
    const { send, events } = setup([]);

    await send({ kind: ToHost.AiStart, agent: AcpId.OpenCode });

    const failed = events().find((e) => e.kind === AgentEventKind.Failed);
    expect(failed && failed.kind === AgentEventKind.Failed && failed.reason).toContain('npm i -g opencode-ai');
  });

  it('runs an npx adapter only after the user allows it in the chat', async () => {
    const { send, events, asked, states, sent } = setup(['/home/none/.claude']);

    const starting = send({ kind: ToHost.AiStart, agent: AcpId.Claude });
    await eventually(() => sent.some((m) => m.kind === ToView.AiConsent));
    await send({ kind: ToHost.AiConsent, allow: false });
    await starting;

    expect(asked).toEqual([]);
    expect(states()).not.toContain(AiState.Ready);
    expect(events()).toEqual([]);
  });
});

const turn = async (t: ReturnType<typeof setup>, prompt: string) => {
  await t.send({ kind: ToHost.AiStart, agent: AcpId.OpenCode });
  await t.send({ kind: ToHost.AiSend, text: prompt, context: null, images: [] });
  await eventually(() => t.events().some((e) => e.kind === AgentEventKind.Done));
};

describe('files an agent changes without asking us', () => {
  it('lists an edit made straight on disk and undoes it', async () => {
    const t = setup();

    await turn(t, 'disk src/Page.svelte');

    expect(t.read('src/Page.svelte')).toBe('written by the agent\n');
    expect(t.changes()).toMatchObject([{ prop: 'agent', value: 'OpenCode', files: ['src/Page.svelte'] }]);
    await t.send({ kind: ToHost.Undo });
    expect(t.read('src/Page.svelte')).toBe('<h1>Hi</h1>\n');
    await t.session.stop();
  });

  it('lists a file created straight on disk and removes it on undo', async () => {
    const t = setup();

    await turn(t, 'disk src/Fresh.svelte');

    expect(t.changes()).toMatchObject([{ value: 'OpenCode', files: ['src/Fresh.svelte'] }]);
    await t.send({ kind: ToHost.Undo });
    expect(t.exists('src/Fresh.svelte')).toBe(false);
    await t.session.stop();
  });

  it('lists a file deleted straight on disk and brings it back on undo', async () => {
    const t = setup();

    await turn(t, 'diskRemove src/Page.svelte');

    expect(t.exists('src/Page.svelte')).toBe(false);
    expect(t.changes()).toMatchObject([{ value: 'OpenCode', files: ['src/Page.svelte'] }]);
    await t.send({ kind: ToHost.Undo });
    expect(t.read('src/Page.svelte')).toBe('<h1>Hi</h1>\n');
    await t.session.stop();
  });

  it('lists a file once when the agent writes both ways', async () => {
    const t = setup();

    await turn(t, 'mixed src/Page.svelte');

    expect(t.changes().map((c) => c.files)).toEqual([['src/Direct.txt'], ['src/Page.svelte']]);
    await t.send({ kind: ToHost.Undo });
    await t.send({ kind: ToHost.Undo });
    expect(t.read('src/Page.svelte')).toBe('<h1>Hi</h1>\n');
    expect(t.exists('src/Direct.txt')).toBe(false);
    await t.session.stop();
  });
});
