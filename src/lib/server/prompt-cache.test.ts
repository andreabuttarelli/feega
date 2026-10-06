import { describe, expect, it } from 'vitest';
import { withPromptCache } from './prompt-cache';

const request = (model: string, extra: Record<string, unknown> = {}) => JSON.stringify({ model, input: [{ role: 'system', content: 'rules' }], ...extra });

describe('prompt caching on the gateway', () => {
  it('an Anthropic request carries one cache breakpoint, so every step re-reads the shared prefix from cache', () => {
    expect(JSON.parse(withPromptCache(request('anthropic/claude-opus-5.5')))).toMatchObject({ cache_control: { type: 'ephemeral' } });
  });

  it('other providers cache by themselves and get the request untouched', () => {
    expect(withPromptCache(request('google/gemini-3.7-flash'))).toBe(request('google/gemini-3.7-flash'));
  });

  it('a breakpoint already set is kept', () => {
    const set = request('anthropic/claude-opus-5.5', { cache_control: { type: 'ephemeral', ttl: '1h' } });

    expect(JSON.parse(withPromptCache(set)).cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
  });

  it('a body that is not JSON passes through', () => {
    expect(withPromptCache('not json')).toBe('not json');
  });
});
