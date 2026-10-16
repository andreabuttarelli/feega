import { describe, expect, it } from 'vitest';
import { PROVIDER_NAMES, providerName } from './model-provider';
import { TASK_PROVIDERS } from '$lib/server/generation/task-providers';
import { PRIMARY_ROUTE } from '$lib/server/generation/discount-routes';

describe('provider display names come from one table, always capitalised', () => {
  it('names the media providers as their brands write them', () => {
    expect(providerName('kie')).toBe('Kie.ai');
    expect(providerName('openrouter')).toBe('OpenRouter');
    expect(providerName('wiro')).toBe('Wiro');
    expect(providerName('higgsfield')).toBe('Higgsfield');
  });

  it('every media provider name starts with a capital letter', () => {
    const media = ['openrouter', ...Object.keys(TASK_PROVIDERS)].map((id) => PROVIDER_NAMES[id]);
    expect(media.filter((name) => name[0] !== name[0].toUpperCase())).toEqual([]);
  });

  it('the routing tables read their labels from it', () => {
    expect(Object.entries(TASK_PROVIDERS).map(([id, facts]) => facts.label === providerName(id))).not.toContain(false);
    expect(PRIMARY_ROUTE.label).toBe(providerName(PRIMARY_ROUTE.provider));
  });
});
