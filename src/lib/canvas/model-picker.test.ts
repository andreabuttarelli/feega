import { describe, it, expect } from 'vitest';
import { filterChoices, groupByProvider, modelGroupsOf, recommendedFirst } from './model-picker';
import type { ModelChoice } from './gen-node';

const choice = (over: Partial<ModelChoice> = {}): ModelChoice => ({
  id: 'm1',
  label: 'Modello',
  aspectRatios: [],
  provider: 'anthropic',
  providerLabel: 'Anthropic',
  ...over
});

describe('modelGroupsOf: il menu del modello come gruppi di voci', () => {
  it('Recommended in cima, poi un gruppo per provider; un raccomandato compare anche sotto il suo provider', () => {
    const top = choice({ id: 'top', label: 'Top', provider: 'google', providerLabel: 'Google', tiers: ['best'] });
    const plain = choice({ id: 'plain', label: 'Plain', provider: 'openai', providerLabel: 'OpenAI' });

    const groups = modelGroupsOf([top, plain]);

    expect(groups.map((g) => g.id)).toEqual(['recommended', 'google', 'openai']);
    expect(groups[0].items).toEqual([{ value: 'top', label: 'Top', keywords: 'Google' }]);
  });

  it("senza raccomandati non c'è la sezione", () => {
    expect(modelGroupsOf([choice({ id: 'x' })]).map((g) => g.id)).not.toContain('recommended');
  });
});

describe('filterChoices: cerca per nome del modello o del provider, senza badare al maiuscolo', () => {
  it('una query vuota non filtra niente', () => {
    const choices = [choice({ id: 'a' }), choice({ id: 'b' })];
    expect(filterChoices(choices, '')).toEqual(choices);
  });

  it('trova per sottostringa del nome del modello, ignorando il maiuscolo', () => {
    const claude = choice({ id: 'a', label: 'Claude Haiku' });
    const gpt = choice({ id: 'b', label: 'GPT Image 2' });
    expect(filterChoices([claude, gpt], 'haiku')).toEqual([claude]);
  });

  it('trova anche per il nome del provider', () => {
    const claude = choice({ id: 'a', label: 'Claude Haiku', provider: 'anthropic', providerLabel: 'Anthropic' });
    const gpt = choice({ id: 'b', label: 'GPT Image 2', provider: 'openai', providerLabel: 'OpenAI' });
    expect(filterChoices([claude, gpt], 'OPENAI')).toEqual([gpt]);
  });
});

describe('groupByProvider: un gruppo per provider, nell\'ordine in cui compaiono nel catalogo', () => {
  it('raggruppa le scelte sotto il loro provider', () => {
    const a = choice({ id: 'a', provider: 'anthropic', providerLabel: 'Anthropic' });
    const b = choice({ id: 'b', provider: 'openai', providerLabel: 'OpenAI' });
    const c = choice({ id: 'c', provider: 'anthropic', providerLabel: 'Anthropic' });

    expect(groupByProvider([a, b, c])).toEqual([
      { provider: 'anthropic', providerLabel: 'Anthropic', choices: [a, c] },
      { provider: 'openai', providerLabel: 'OpenAI', choices: [b] }
    ]);
  });

  it('un catalogo vuoto non produce gruppi', () => {
    expect(groupByProvider([])).toEqual([]);
  });
});

describe('recommendedFirst: la sezione "Recommended" in cima al menù', () => {
  it('mette i raccomandati in ordine best, balanced, cheapest-good, uno per modello', () => {
    const cheap = choice({ id: 'cheap', tiers: ['cheapest-good'] });
    const top = choice({ id: 'top', tiers: ['best', 'balanced'] });
    const plain = choice({ id: 'plain' });

    expect(recommendedFirst([cheap, plain, top]).map((c) => c.id)).toEqual(['top', 'cheap']);
  });

  it('senza raccomandati la sezione è vuota', () => {
    expect(recommendedFirst([choice()])).toEqual([]);
  });
});
