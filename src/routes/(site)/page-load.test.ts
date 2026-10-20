import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ browser: true, apiBase: '' as string | null }));
vi.mock('$app/environment', () => ({ get browser() { return state.browser; } }));
vi.mock('$lib/api/bundle-fetch', () => ({ bundleApiBase: () => state.apiBase }));

const { load } = await import('./+page');

beforeEach(() => {
  state.browser = true;
  state.apiBase = null;
});

describe('the root page', () => {
  it('in the native bundle opens the app, not the marketing homepage (the shell started on the landing page)', () => {
    state.apiBase = 'https://feega.app';

    expect(() => load()).toThrow(expect.objectContaining({ location: '/app' }));
  });

  it('on the web stays the homepage', () => {
    expect(load()).toBeUndefined();
    state.browser = false;
    state.apiBase = 'https://feega.app';
    expect(load()).toBeUndefined();
  });
});
