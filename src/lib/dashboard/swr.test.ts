import { describe, expect, it, vi } from 'vitest';
import { SwrCache } from './swr';

function clock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('a stale-while-revalidate cache for dashboard navigation', () => {
  it('a first visit waits for the network', async () => {
    const cache = new SwrCache(clock().now);
    const fetcher = vi.fn(async () => 'v1');

    expect(await cache.read('k', fetcher, () => {})).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a return visit answers from cache at once and revalidates in the background', async () => {
    const time = clock();
    const cache = new SwrCache(time.now);
    await cache.read('k', async () => 'v1', () => {});
    time.advance(10_000);

    const fresh = vi.fn();
    expect(await cache.read('k', async () => 'v2', fresh)).toBe('v1');
    await settle();

    expect(fresh).toHaveBeenCalledTimes(1);
    expect(await cache.read('k', vi.fn(), () => {})).toBe('v2');
  });

  it('an unchanged answer does not re-render, and a just-fetched entry is not fetched again', async () => {
    const time = clock();
    const cache = new SwrCache(time.now);
    await cache.read('k', async () => ({ a: 1 }), () => {});
    time.advance(10_000);

    const fresh = vi.fn();
    await cache.read('k', async () => ({ a: 1 }), fresh);
    await settle();
    const again = vi.fn(async () => ({ a: 2 }));
    await cache.read('k', again, fresh);

    expect(fresh).not.toHaveBeenCalled();
    expect(again).not.toHaveBeenCalled();
  });

  it('a failed revalidation keeps the cached answer', async () => {
    const time = clock();
    const cache = new SwrCache(time.now);
    await cache.read('k', async () => 'v1', () => {});
    time.advance(10_000);

    await cache.read('k', async () => Promise.reject(new Error('offline')), () => {});
    await settle();

    expect(await cache.read('k', async () => 'v2', () => {})).toBe('v1');
  });

  it('a write forgets everything, so the next visit reads the network', async () => {
    const cache = new SwrCache(clock().now);
    await cache.read('k', async () => 'v1', () => {});
    cache.clear();

    expect(await cache.read('k', async () => 'v2', () => {})).toBe('v2');
  });

  it('a fetch warmed before the page asks is the one the page awaits', async () => {
    const cache = new SwrCache(clock().now);
    const fetcher = vi.fn(async () => 'v1');
    cache.warm('k', fetcher);

    const later = vi.fn(async () => 'v2');
    expect(await cache.read('k', later, () => {})).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
  });

  it('a failed warm-up leaves the page to fetch for itself', async () => {
    const cache = new SwrCache(clock().now);
    cache.warm('k', async () => Promise.reject(new Error('offline')));

    expect(await cache.read('k', async () => 'v2', () => {})).toBe('v2');
  });
});
