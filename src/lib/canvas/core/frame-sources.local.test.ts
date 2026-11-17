import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({}) as Record<string, string>);
vi.mock('$env/dynamic/public', () => ({ env }));

const { scopeFrameCache } = await import('./frame-sources');

const SCOPE = { userId: 'u1', orgId: 'o1' };

afterEach(() => {
  delete env.PUBLIC_FEEGA_LOCAL;
  vi.unstubAllGlobals();
});

describe('the browser copy of frame sources', () => {
  it('is not kept in local mode: the local server answers from memory, and writing 1-7 MB per frame to IndexedDB cost the main thread a third of a second on a cold open', () => {
    vi.stubGlobal('indexedDB', {});
    env.PUBLIC_FEEGA_LOCAL = '1';

    expect(scopeFrameCache(SCOPE)).toBeNull();
  });
});
