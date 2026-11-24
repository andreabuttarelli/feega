import { describe, expect, it } from 'vitest';
import { UsageKind } from '../usage';
import { AgentEventKind, type AgentEvent, type ToolView } from './agent-session';
import { aiUsage } from './ai-usage';

const tool = (id: string, kind = 'edit'): ToolView => ({ id, title: 'Edit /Users/me/secret.ts', kind, status: 'pending' as ToolView['status'], diffs: [] });

function setup() {
  const tracked: { kind: UsageKind; extra: Record<string, unknown> }[] = [];
  let clock = 1_000;
  const usage = aiUsage({ track: (kind, extra = {}) => void tracked.push({ kind, extra }) }, () => clock);

  return { usage, tracked, advance: (ms: number) => (clock += ms), kinds: () => tracked.map((t) => t.kind) };
}

describe('aiUsage', () => {
  it('records the agent chosen and the session start', () => {
    const t = setup();
    t.usage.started('claude');

    expect(t.tracked).toEqual([
      { kind: UsageKind.AiAgentChosen, extra: { agent: 'claude' } },
      { kind: UsageKind.AiSessionStarted, extra: { agent: 'claude' } }
    ]);
  });

  it('times the first response from the message and counts it once', () => {
    const t = setup();
    t.usage.started('claude');
    t.usage.sent();
    t.advance(750);
    t.usage.heard({ kind: AgentEventKind.Text, text: 'secret reply' });
    t.usage.heard({ kind: AgentEventKind.Text, text: 'more' });

    const first = t.tracked.filter((e) => e.kind === UsageKind.AiFirstResponse);
    expect(first).toEqual([{ kind: UsageKind.AiFirstResponse, extra: { agent: 'claude', duration_ms: 750 } }]);
  });

  it('counts each tool once and sends only its kind', () => {
    const t = setup();
    t.usage.started('claude');
    t.usage.heard({ kind: AgentEventKind.Tool, tool: tool('1') });
    t.usage.heard({ kind: AgentEventKind.Tool, tool: tool('1') });
    t.usage.heard({ kind: AgentEventKind.Tool, tool: tool('2', 'read') });

    expect(t.tracked.filter((e) => e.kind === UsageKind.AiToolCall).map((e) => e.extra)).toEqual([{ agent: 'claude', tool: 'edit' }, { agent: 'claude', tool: 'read' }]);
    expect(JSON.stringify(t.tracked)).not.toContain('secret');
  });

  it('records allow and reject from the option chosen', () => {
    const t = setup();
    t.usage.started('claude');
    t.usage.heard({ kind: AgentEventKind.Permission, id: 'p1', tool: tool('1'), options: [{ id: 'yes', name: 'Allow', allows: true }, { id: 'no', name: 'Reject', allows: false }] });
    t.usage.answered('p1', 'yes');
    t.usage.heard({ kind: AgentEventKind.Permission, id: 'p2', tool: tool('2'), options: [{ id: 'yes', name: 'Allow', allows: true }] });
    t.usage.answered('p2', null);

    expect(t.tracked.filter((e) => e.kind === UsageKind.AiPermission).map((e) => e.extra.outcome)).toEqual(['allow', 'reject']);
  });

  it('records a failure by class only, never its reason', () => {
    const t = setup();
    t.usage.started('claude');
    t.usage.heard({ kind: AgentEventKind.Failed, reason: 'ENOENT /Users/me/app' });

    expect(t.tracked.at(-1)).toEqual({ kind: UsageKind.AiSessionError, extra: { agent: 'claude', error_class: 'agent_failed' } });
  });

  it('records a cancel and the session totals when it ends', () => {
    const t = setup();
    t.usage.started('claude');
    t.usage.sent();
    t.usage.sent();
    t.usage.heard({ kind: AgentEventKind.Tool, tool: tool('1') });
    t.usage.cancelled();
    t.advance(5_000);
    t.usage.ended();

    expect(t.kinds()).toContain(UsageKind.AiCancel);
    expect(t.tracked.at(-1)).toEqual({ kind: UsageKind.AiSessionEnded, extra: { agent: 'claude', message_count: 2, tool_count: 1, duration_ms: 5_000 } });
  });

  it('starting another agent ends the running session first', () => {
    const t = setup();
    t.usage.started('claude');
    t.usage.started('codex');

    expect(t.kinds()).toEqual([UsageKind.AiAgentChosen, UsageKind.AiSessionStarted, UsageKind.AiSessionEnded, UsageKind.AiAgentChosen, UsageKind.AiSessionStarted]);
  });

  it('ignores events while no session runs', () => {
    const t = setup();
    t.usage.sent();
    t.usage.heard({ kind: AgentEventKind.Done, reason: 'end_turn' } as AgentEvent);
    t.usage.ended();

    expect(t.tracked).toEqual([]);
  });
});
