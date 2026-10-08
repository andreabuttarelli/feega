import { describe, it, expect } from 'vitest';
import { CostTier, defaultEffortOf, groupByProvider, shortLabel, type ChatModelOption } from './chat-model';

const option = (over: Partial<ChatModelOption>): ChatModelOption => ({
  id: 'x/y',
  label: 'X: Y',
  provider: 'x',
  costTier: CostTier.Low,
  inputUsdPerM: 1,
  outputUsdPerM: 1,
  efforts: [],
  defaultEffort: null,
  ...over
});

describe('default reasoning per model', () => {
  it('the default model starts at low', () => {
    expect(defaultEffortOf(option({ id: 'anthropic/claude-opus-5.5', efforts: ['high', 'medium', 'low'], defaultEffort: 'high' }))).toBe('low');
  });

  it('any other model starts at what the catalogue declares', () => {
    expect(defaultEffortOf(option({ efforts: ['max', 'high', 'low'], defaultEffort: 'max' }))).toBe('max');
  });

  it('a model without reasoning control has no default', () => {
    expect(defaultEffortOf(option({}))).toBeNull();
  });
});

describe('model menu', () => {
  it('groups by provider, both levels sorted', () => {
    const groups = groupByProvider([
      option({ id: 'z/b', label: 'Z: B', provider: 'z' }),
      option({ id: 'a/q', label: 'A: Q', provider: 'a' }),
      option({ id: 'z/a', label: 'Z: A', provider: 'z' })
    ]);
    expect(groups.map((g) => g.provider)).toEqual(['a', 'z']);
    expect(groups[1].options.map((o) => o.id)).toEqual(['z/a', 'z/b']);
  });

  it('drops the vendor prefix from the label', () => {
    expect(shortLabel(option({ label: 'Anthropic: Claude Sonnet 5.5' }))).toBe('Claude Sonnet 5.5');
    expect(shortLabel(option({ label: 'Plain' }))).toBe('Plain');
  });
});
