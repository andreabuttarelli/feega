import { describe, expect, it } from 'vitest';
import { AGENT_SHAPES, agentAvatar, agentMark, agentsOf } from './agent-presence';
import { toCanvasMark, type CanvasPeer } from './canvas-presence';

const agent = { id: 'agent:mcp:s1', name: 'MCP agent' };

describe('agentAvatar: random but stable per agent session', () => {
  it('the same session always gets the same shape, colour and initial', () => {
    expect(agentAvatar('agent:sidebar:t1', 'Claude')).toEqual(agentAvatar('agent:sidebar:t1', 'Claude'));
  });

  it('different sessions spread over several shapes', () => {
    const shapes = new Set(Array.from({ length: 40 }, (_, i) => agentAvatar(`agent:mcp:${i}`, 'MCP agent').shape));
    expect(shapes.size).toBeGreaterThan(2);
    expect([...shapes].every((s) => AGENT_SHAPES.includes(s))).toBe(true);
  });

  it('the initial comes from the name', () => {
    expect(agentAvatar('x', 'Claude · subagent 2').initial).toBe('C');
  });
});

describe('agentMark: where an agent works, as a canvas mark', () => {
  const boxes = [{ id: 'n1', x: 0, y: 0, w: 100, h: 100 }, { id: 'n2', x: 200, y: 0, w: 100, h: 50 }];

  it('puts the cursor inside the boxes it touched and selects them', () => {
    const mark = agentMark(agent, { boxes, doing: 'set text' }, 42);
    expect(mark.cursor!.x).toBeGreaterThanOrEqual(0);
    expect(mark.cursor!.x).toBeLessThanOrEqual(300);
    expect(mark.cursor!.y).toBeGreaterThanOrEqual(0);
    expect(mark.cursor!.y).toBeLessThanOrEqual(100);
    expect(mark.selection).toEqual(['n1', 'n2']);
    expect(mark).toMatchObject({ sessionId: agent.id, userId: agent.id, name: 'MCP agent', agent: { doing: 'set text' }, at: 42 });
  });

  it('survives the wire: a peer parses it with the agent part intact', () => {
    expect(toCanvasMark(agentMark(agent, { boxes, doing: 'move node' }, 1))?.agent).toEqual({ doing: 'move node' });
  });

  it('a human mark parses without an agent part', () => {
    const human = { sessionId: 's', userId: 'u', name: 'u', cursor: null, selection: [], at: 1 };
    expect(toCanvasMark(human)?.agent).toBeNull();
  });
});

describe('agentsOf: the agents among the peers', () => {
  const peer = (over: Partial<CanvasPeer>): CanvasPeer => ({ sessionId: 's', userId: 'u', name: 'u', cursor: null, selection: [], live: [], view: null, presenting: false, chat: null, agent: null, at: 0, colour: '#000', ...over });

  it('keeps only agent peers', () => {
    const list = agentsOf([peer({}), peer({ sessionId: 'a', userId: 'a', name: 'Claude', agent: { doing: 'set text' } })]);
    expect(list.map((p) => p.sessionId)).toEqual(['a']);
  });
});
