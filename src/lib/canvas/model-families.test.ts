import { describe, it, expect } from 'vitest';
import { familyOf, modelName, priceHeader, priceLabel, familyGroups, searchModels } from './model-families';
import type { ModelChoice } from './gen-node';

const choice = (over: Partial<ModelChoice> = {}): ModelChoice => ({
  id: 'm1',
  label: 'Model',
  aspectRatios: [],
  provider: 'other',
  providerLabel: 'Other',
  ...over
});

describe('familyOf', () => {
  it('a Wiro GPT image model belongs to GPT', () => {
    expect(familyOf(choice({ id: 'wiro/openai/gpt-image-2-6-sunburst', label: 'GPT Image 2 (Sunburst)', provider: 'openai', providerLabel: 'OpenAI' })).key).toBe('gpt');
  });

  it('an Anthropic model belongs to Claude', () => {
    expect(familyOf(choice({ id: 'anthropic/claude-sonnet-5.5', label: 'Anthropic: Claude Sonnet 5.5', provider: 'anthropic' })).key).toBe('claude');
  });

  it('Veo and Gemini are separate families of the same vendor', () => {
    expect(familyOf(choice({ id: 'wiro/google/veo3-1', label: 'Veo 3.1' })).key).toBe('veo');
    expect(familyOf(choice({ id: 'google/gemini-3-pro', label: 'Gemini 3 Pro' })).key).toBe('gemini');
  });

  it('an unknown vendor falls back to its provider with a monogram', () => {
    const family = familyOf(choice({ id: 'acme/thing-1', label: 'Thing 1', provider: 'acme', providerLabel: 'Acme' }));
    expect(family).toMatchObject({ key: 'acme', label: 'Acme', icon: 'acme' });
  });
});

describe('modelName', () => {
  it('strips vendor, family word and codename', () => {
    expect(modelName(choice({ id: 'anthropic/claude-sonnet-5.5', label: 'Anthropic: Claude Sonnet 5.5' }))).toBe('Sonnet 5.5');
  });

  it('keeps product words that are the name itself', () => {
    expect(modelName(choice({ id: 'wiro/openai/gpt-image-2-6-sunburst', label: 'GPT Image 2 (Sunburst)' }))).toBe('GPT Image 2');
  });

  it('humanizes a label that is still a wire id', () => {
    expect(modelName(choice({ id: 'wiro/klingai/kling-v4', label: 'wiro/klingai/kling-v4' }))).toBe('Kling V4');
  });
});

describe('price', () => {
  it('headers fit the medium', () => {
    expect(priceHeader('text')).toEqual({ unit: 'Per 1M tokens', detail: 'in / out' });
    expect(priceHeader('image').unit).toBe('Per image');
    expect(priceHeader('video').unit).toBe('Per second');
    expect(priceHeader('audio').unit).toBe('Per 1K chars');
    expect(priceHeader('model3d').unit).toBe('Per run');
  });

  it('text shows in / out per million in dollars', () => {
    const c = choice({ textPricing: { inputCreditsPerMillion: 240, outputCreditsPerMillion: 1200, systemPromptTokens: 0 } });
    expect(priceLabel(c, 'text')).toBe('$2 / $10');
  });

  it('image shows the unit price, video the cheapest per-second rate', () => {
    expect(priceLabel(choice({ unitCredits: 6 }), 'image')).toBe('$0.05');
    expect(priceLabel(choice({ perSecondCredits: { with: { '720p': 24, '1080p': 36 } } }), 'video')).toBe('$0.20');
  });

  it('audio is priced per thousand characters', () => {
    expect(priceLabel(choice({ creditsPerCharacter: 0.024 }), 'audio')).toBe('$0.20');
  });

  it('no price, no label', () => {
    expect(priceLabel(choice(), 'image')).toBeNull();
  });
});

describe('familyGroups', () => {
  it('one group per family in registry order, newest model first', () => {
    const groups = familyGroups([
      choice({ id: 'gpt-5', label: 'GPT-5' }),
      choice({ id: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8' }),
      choice({ id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5' })
    ]);

    expect(groups.map((g) => g.key)).toEqual(['claude', 'gpt']);
    expect(groups[0].models.map((m) => m.name)).toEqual(['Sonnet 5.5', 'Opus 4.8']);
  });

  it('recommended models get a group on top, named modes their own group', () => {
    const groups = familyGroups([
      choice({ id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', tiers: ['best'] }),
      choice({ id: 'swap', label: 'Object swap', menuGroup: 'Transform video' })
    ]);

    expect(groups.map((g) => g.key)).toEqual(['recommended', 'Transform video', 'claude']);
  });
});

describe('searchModels', () => {
  it('flattens matches across families by name, family or provider', () => {
    const all = [
      choice({ id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5' }),
      choice({ id: 'gpt-5', label: 'GPT-5', providerLabel: 'OpenAI' })
    ];
    expect(searchModels(all, 'claude').map((m) => m.choice.id)).toEqual(['anthropic/claude-sonnet-5.5']);
    expect(searchModels(all, 'openai').map((m) => m.choice.id)).toEqual(['gpt-5']);
  });
});
