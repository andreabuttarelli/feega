import { describe, expect, it, vi } from 'vitest';
import { AGENT_SEND_GAP_MS, agentIdentity, agentPresence, touchedNodes, type AgentPorts, type NodeBox } from './agent-cursor';
import type { CanvasMark } from '$lib/realtime/canvas-presence';

const box = (id: string, canvasId = 'c1'): NodeBox => ({ id, canvasId, x: 10, y: 20, w: 100, h: 50 });

function harness(boxes: NodeBox[], lane: string | null = null) {
  let clock = 1000;
  const timers: Array<{ at: number; run: () => void }> = [];
  const sent: Array<{ canvasId: string; mark: CanvasMark }> = [];
  const ports: AgentPorts = {
    enabled: () => true,
    boxes: async (_scope, ids) => boxes.filter((b) => ids.includes(b.id)),
    send: async (canvasId, mark) => void sent.push({ canvasId, mark }),
    now: () => clock,
    later: (run, ms) => void timers.push({ at: clock + ms, run }),
    lane: () => lane
  };
  const advance = (ms: number) => {
    clock += ms;
    timers.filter((t) => t.at <= clock).forEach((t) => {
      timers.splice(timers.indexOf(t), 1);
      t.run();
    });
  };
  return { presence: agentPresence(ports), sent, advance };
}

const chat = { db: {} as never, orgId: 'o', userId: 'u', agentKey: 'sidebar', sessionId: 't1' };
const mcp = { ...chat, agentKey: 'mcp', sessionId: 'm1' };

describe('agentIdentity: one cursor per agent session', () => {
  it('names the chat agent and its sub-agents apart', () => {
    expect(agentIdentity(chat, null)).toEqual({ id: 'agent:sidebar:t1', name: 'Claude' });
    expect(agentIdentity(chat, 'subagent 2')).toEqual({ id: 'agent:sidebar:t1:subagent 2', name: 'Claude · subagent 2' });
  });

  it('names an external agent by how it connected', () => {
    expect(agentIdentity(mcp, null).name).toBe('MCP agent');
  });

  it('falls back to the user when there is no session', () => {
    expect(agentIdentity({ ...mcp, sessionId: null }, null).id).toBe('agent:mcp:u');
  });
});

describe('agentPresence: tool execution publishes where the agent works', () => {
  it('a touched node becomes a cursor and a selection on its canvas', async () => {
    const { presence, sent } = harness([box('n1')]);
    await presence.touched(mcp, ['n1'], 'set_text');
    expect(sent).toHaveLength(1);
    expect(sent[0].canvasId).toBe('c1');
    expect(sent[0].mark).toMatchObject({ sessionId: 'agent:mcp:m1', name: 'MCP agent', selection: ['n1'], agent: { doing: 'set text' } });
    expect(sent[0].mark.cursor).not.toBeNull();
  });

  it('a sub-agent publishes under its own cursor', async () => {
    const { presence, sent } = harness([box('n1')], 'subagent 2');
    await presence.touched(chat, ['n1'], 'move_node');
    expect(sent[0].mark.name).toBe('Claude · subagent 2');
  });

  it('nodes on two canvases reach both', async () => {
    const { presence, sent } = harness([box('a', 'c1'), box('b', 'c2')]);
    await presence.touched(mcp, ['a', 'b'], 'move_node');
    expect(sent.map((s) => s.canvasId).sort()).toEqual(['c1', 'c2']);
  });

  it('nothing found, nothing sent', async () => {
    const { presence, sent } = harness([]);
    await presence.touched(mcp, ['gone'], 'move_node');
    await presence.touched(mcp, [], 'list_canvases');
    expect(sent).toHaveLength(0);
  });

  it('a burst sends the first and the last, not every step', async () => {
    const { presence, sent, advance } = harness([box('a'), box('b'), box('c')]);
    await presence.touched(mcp, ['a'], 'set_text');
    await presence.touched(mcp, ['b'], 'set_text');
    await presence.touched(mcp, ['c'], 'set_text');
    expect(sent.map((s) => s.mark.selection)).toEqual([['a']]);
    advance(AGENT_SEND_GAP_MS);
    await vi.waitFor(() => expect(sent.map((s) => s.mark.selection)).toEqual([['a'], ['c']]));
  });

  it('a person never publishes an agent cursor', async () => {
    const { presence, sent } = harness([box('n1')]);
    await presence.touched({ ...mcp, agentKey: null }, ['n1'], 'set_text');
    expect(sent).toHaveLength(0);
  });
});

describe('touchedNodes: the node ids an op read or wrote', () => {
  it('collects ids from the input and the answer', () => {
    const ids = touchedNodes({ nodeId: 'a', nodeIds: ['b'], frameId: 'c', canvasId: 'x' }, { node: { id: 'd' }, nodeIds: ['e'], count: 3 });
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('ignores what is not an id', () => {
    expect(touchedNodes({ nodeId: 3, nodeIds: [null] }, null)).toEqual([]);
  });
});
