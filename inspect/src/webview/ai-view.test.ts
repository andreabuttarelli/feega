import { describe, expect, it } from 'vitest';
import { AiState } from '../messages';
import { ConfigCategory, ToolStatus } from '../host/ai/agent-session';
import { Policy } from '../host/ai/permission-policy';
import { AcpId } from '../host/ai/acp-agents';
import { Dot, agoOf, isDanger, isThinking, markOf, pickerLabel, pickerOf, valueName, placeholderOf, statusOf } from './ai-view';
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

  it('has a real logo for every agent in the picker', () => {
    const ids = Object.values(AcpId);

    expect(ids.filter((id) => markOf(id, id).logo === null)).toEqual([]);
  });

  it('falls back to the initial for an unknown agent', () => {
    expect(markOf('mystery', 'Mystery')).toEqual({ logo: null, initial: 'M' });
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

describe('agoOf', () => {
  const now = Date.UTC(2026, 10, 25, 12);

  it.each([
    [30_000, 'now'],
    [5 * 60_000, '5m'],
    [3 * 3_600_000, '3h'],
    [2 * 86_400_000, '2d'],
    [40 * 86_400_000, '5w']
  ])('says how long ago %i ms was', (elapsed, label) => {
    expect(agoOf(now, now - elapsed)).toBe(label);
  });
});

describe('the model and effort pickers', () => {
  const model = { id: 'model', name: 'Model', category: ConfigCategory.Model, current: 'haiku', values: [{ id: 'haiku', name: 'Haiku', description: '' }] };
  const effort = { id: 'reasoning_effort', name: 'Reasoning effort', category: ConfigCategory.Effort, current: 'xhigh', values: [] };

  it('finds an option by its category whatever its id', () => {
    expect(pickerOf([model, effort], ConfigCategory.Effort)?.id).toBe('reasoning_effort');
  });

  it('is absent when the agent does not advertise it', () => {
    expect(pickerOf([model], ConfigCategory.Effort)).toBeUndefined();
  });

  it('shows the name of the current value, or the value itself when unnamed', () => {
    expect(valueName(model)).toBe('Haiku');
    expect(valueName(effort)).toBe('xhigh');
  });
});
