import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import ChatModelPicker from './ChatModelPicker.svelte';
import { CostTier, groupByProvider, type ChatModelChoice, type ChatModelOption } from '$lib/chat-model';

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

const GROUPS = groupByProvider([
  option({ id: 'anthropic/claude-sonnet-5.5', label: 'Anthropic: Claude Sonnet 5.5', provider: 'anthropic', costTier: CostTier.High, efforts: ['high', 'medium', 'low', 'none'] }),
  option({ id: 'mistralai/plain', label: 'Mistral: Plain', provider: 'mistralai' })
]);

const html = (choice: ChatModelChoice) => render(ChatModelPicker, { props: { groups: GROUPS, choice, onchoose: () => {} } }).body;

describe('chat model picker', () => {
  it('lists models grouped by provider, with a short label and the price tier', () => {
    const body = html({ model: 'mistralai/plain', reasoning: null });
    expect(body).toContain('<optgroup label="anthropic"');
    expect(body).toContain('<optgroup label="mistralai"');
    expect(body).toContain('Claude Sonnet 5.5 · $$$');
    expect(body).toContain('Plain · $');
  });

  it('shows the reasoning levels the chosen model declares', () => {
    const body = html({ model: 'anthropic/claude-sonnet-5.5', reasoning: 'medium' });
    expect(body).toContain('name="reasoning"');
    for (const level of ['High', 'Medium', 'Low', 'Off']) {
      expect(body).toContain(`>${level}</option>`);
    }
  });

  it('hides reasoning on a model that does not support it', () => {
    expect(html({ model: 'mistralai/plain', reasoning: null })).not.toContain('name="reasoning"');
  });
});
