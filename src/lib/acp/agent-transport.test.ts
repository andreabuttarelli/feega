import { describe, expect, it } from 'vitest';
import { AgentSurface, AgentTransport, TRANSPORT_OF, agentFetch, surfaceOf, type LocalAgentsBridge } from './agent-transport';
import { AcpChat, Line } from './acp-chat.svelte';
import { AgentChoices } from './agent-choices.svelte';
import { AcpEventKind, type AcpEvent } from './acp-events';

const DESKTOP_UA = 'Mozilla/5.0 Electron/38.2.0 FeegaNative/0.1.0';
const BROWSER_UA = 'Mozilla/5.0 Chrome/140';
const LOCAL = { PUBLIC_FEEGA_LOCAL: '1' };
const PROJECT = '0aef6d1a-1111-4222-8333-444455556666';

describe('the surface decides the transport', () => {
  it('a .feega file talks HTTP to its local server, wherever it opens', () => {
    expect(surfaceOf(LOCAL, DESKTOP_UA)).toBe(AgentSurface.LocalFile);
    expect(surfaceOf(LOCAL, BROWSER_UA)).toBe(AgentSurface.LocalFile);
  });

  it('the cloud app in the desktop window talks IPC; in a browser it has no local agents', () => {
    expect(surfaceOf({}, DESKTOP_UA)).toBe(AgentSurface.DesktopHosted);
    expect(surfaceOf({}, BROWSER_UA)).toBe(AgentSurface.Browser);
  });

  it('one row per surface', () => {
    expect(TRANSPORT_OF).toEqual({ [AgentSurface.LocalFile]: AgentTransport.Http, [AgentSurface.DesktopHosted]: AgentTransport.Ipc, [AgentSurface.Browser]: AgentTransport.None });
  });

  it('IPC without the desktop bridge means no local agents', () => {
    expect(agentFetch(AgentTransport.Ipc, { bridge: undefined, context: async () => ({ projectId: PROJECT, token: 't' }) })).toBeNull();
    expect(agentFetch(AgentTransport.None, { bridge: undefined, context: async () => ({ projectId: PROJECT, token: 't' }) })).toBeNull();
  });
});

function fakeBridge(events: AcpEvent[]) {
  const calls: { method: string; input: unknown }[] = [];
  let listener: (turnId: string, event: AcpEvent) => void = () => {};
  const bridge: LocalAgentsBridge = {
    protocol: 1,
    list: async (refresh) => {
      calls.push({ method: 'list', input: refresh });
      return { agents: [], chosen: 'claude' };
    },
    choose: async (id) => void calls.push({ method: 'choose', input: id }),
    start: async (turn) => {
      calls.push({ method: 'start', input: turn });
      queueMicrotask(() => events.forEach((e) => listener(turn.turnId, e)));
    },
    answer: async (answer) => {
      calls.push({ method: 'answer', input: answer });
      return true;
    },
    cancel: async (turnId) => void calls.push({ method: 'cancel', input: turnId }),
    onEvent: (fn) => {
      listener = fn;
      return () => {};
    }
  };
  return { bridge, calls };
}

const context = async () => ({ projectId: PROJECT, token: 'jwt' });

describe('the IPC transport speaks the same port as HTTP', () => {
  it('lists and chooses agents through the bridge', async () => {
    const { bridge, calls } = fakeBridge([]);
    const choices = new AgentChoices(agentFetch(AgentTransport.Ipc, { bridge, context })!);
    await choices.load();
    await choices.refresh();
    await choices.choose('codex');

    expect(choices.chosen).toBe('codex');
    expect(calls).toEqual([
      { method: 'list', input: 'cached' },
      { method: 'list', input: 'fresh' },
      { method: 'choose', input: 'codex' }
    ]);
  });

  it('streams a turn with the project and token, and answers permissions', async () => {
    const permission: AcpEvent = { kind: AcpEventKind.Permission, id: 'p1', title: 'feega edit', options: [{ optionId: 'yes', name: 'Allow', kind: 'allow_once' }] };
    const { bridge, calls } = fakeBridge([{ kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hi' } } }, permission, { kind: AcpEventKind.Done, stopReason: 'end_turn' }]);
    const chat = new AcpChat(agentFetch(AgentTransport.Ipc, { bridge, context })!);

    await chat.send('claude', 'add a title');
    await chat.answer('p1', 'yes');

    const start = calls.find((c) => c.method === 'start')!.input as { turnId: string };
    expect(start).toMatchObject({ agent: 'claude', prompt: 'add a title', projectId: PROJECT, token: 'jwt' });
    expect(calls.at(-1)).toEqual({ method: 'answer', input: { turnId: start.turnId, id: 'p1', optionId: 'yes' } });
    expect(chat.lines.map((l) => l.line)).toEqual([Line.User, Line.Agent, Line.Permission]);
  });

  it('stopping cancels the turn in the desktop app', async () => {
    const { bridge, calls } = fakeBridge([]);
    const chat = new AcpChat(agentFetch(AgentTransport.Ipc, { bridge, context })!);
    const turn = chat.send('claude', 'go');
    await new Promise((r) => setTimeout(r));
    chat.stop();
    await turn;

    expect(calls.map((c) => c.method)).toEqual(['start', 'cancel']);
    expect(chat.busy).toBe(false);
  });
});
