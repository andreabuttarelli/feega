import { describe, expect, it } from 'vitest';
import { AiState } from '../messages';
import { ToolStatus } from '../host/ai/agent-session';
import { Policy } from '../host/ai/permission-policy';
import { Dot, isDanger, isThinking, markOf, pickerLabel, placeholderOf, statusOf } from './ai-view';
import { ItemKind } from '../host/ai/transcript';

describe('the agent status', () => {
  it('is green when ready and amber while working', () => {
    expect(statusOf(AiState.Ready).dot).toBe(Dot.Green);
    expect(statusOf(AiState.Busy)).toEqual({ label: 'Working…', dot: Dot.Amber });
  });
});

describe('the composer placeholder', () => {
  it('names the agent and the element', () => {
    expect(placeholderOf('Claude Code')).toBe('Ask Claude Code about this element…');
  });

  it('asks for an agent first', () => {
    expect(placeholderOf(null)).toBe('Choose an agent first');
  });
});

describe('the agent mark', () => {
  it('uses the real logo when there is one', () => {
    expect(markOf('claude', 'Claude Code').logo?.label).toBe('Claude Code');
  });

  it('falls back to the initial', () => {
    expect(markOf('goose', 'Goose')).toEqual({ logo: null, initial: 'G' });
  });
});

describe('the thinking indicator', () => {
  const tool = { kind: ItemKind.Tool as const, tool: { id: 't', title: 'x', kind: 'edit', status: ToolStatus.Running, diffs: [] } };

  it('shows after sending until the agent answers', () => {
    expect(isThinking(true, [{ kind: ItemKind.User, text: 'hi', context: null }])).toBe(true);
    expect(isThinking(true, [tool])).toBe(true);
  });

  it('hides while text streams and when idle', () => {
    expect(isThinking(true, [{ kind: ItemKind.Agent, text: 'Hel' }])).toBe(false);
    expect(isThinking(false, [])).toBe(false);
  });
});

describe('the permission picker', () => {
  const modes = [{ id: 'plan', name: 'Plan', description: '' }];

  it('shows the agent mode and the Feega policy', () => {
    expect(pickerLabel(modes, 'plan', Policy.Edits)).toBe('Plan · Edits');
  });

  it('shows only the policy when the agent has no modes', () => {
    expect(pickerLabel([], null, Policy.Ask)).toBe('Ask');
  });

  it('warns only for Allow all', () => {
    expect(isDanger(Policy.All)).toBe(true);
    expect(isDanger(Policy.Edits)).toBe(false);
  });
});
