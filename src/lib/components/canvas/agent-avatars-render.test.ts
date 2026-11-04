import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import AgentAvatars from './AgentAvatars.svelte';
import type { CanvasPeer } from '$lib/realtime/canvas-presence';

const agent = (sessionId: string, name: string, doing: string): CanvasPeer => ({
  sessionId, userId: sessionId, name, cursor: { x: 0, y: 0 }, selection: [], live: [], view: null, presenting: false, chat: null, agent: { doing }, at: 0, colour: '#0090ff'
});

describe('AgentAvatars', () => {
  it('shows one marked avatar per agent, saying what it is doing', () => {
    const html = render(AgentAvatars, { props: { agents: [agent('agent:sidebar:t', 'Claude', 'set text'), agent('agent:mcp:m', 'MCP agent', 'move node')] } }).body;
    expect(html.match(/data-testid="agent-avatar"/g)).toHaveLength(2);
    expect(html).toContain('data-testid="agent-badge"');
    expect(html).toContain('Claude — set text');
    expect(html).toContain('MCP agent — move node');
  });

  it('renders nothing without agents', () => {
    expect(render(AgentAvatars, { props: { agents: [] } }).body).not.toContain('agent-avatar');
  });
});
