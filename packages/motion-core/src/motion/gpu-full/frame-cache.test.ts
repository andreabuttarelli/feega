import { describe, expect, it, vi } from 'vitest';
import { createFrameCache } from './frame-cache';

const MB = 1024 * 1024;

describe('frame cache', () => {
  it('serves a frame for any time inside its span', () => {
    const cache = createFrameCache<string>({ budget: 10 * MB });
    cache.put('a', 1, 0.5, 'f', MB);

    expect(cache.get('a', 1)).toBe('f');
    expect(cache.get('a', 1.49)).toBe('f');
    expect(cache.get('a', 1.5)).toBeNull();
    expect(cache.get('a', 0.99)).toBeNull();
    expect(cache.get('b', 1)).toBeNull();
  });

  it('evicts the least recently used frame when over budget', () => {
    const closed: string[] = [];
    const cache = createFrameCache<string>({ budget: 2 * MB, onEvict: (v) => closed.push(v) });
    cache.put('a', 0, 1, 'first', MB);
    cache.put('a', 1, 1, 'second', MB);
    cache.get('a', 0.5);
    cache.put('a', 2, 1, 'third', MB);

    expect(closed).toEqual(['second']);
    expect(cache.get('a', 0.5)).toBe('first');
    expect(cache.get('a', 1.5)).toBeNull();
    expect(cache.bytes()).toBe(2 * MB);
  });

  it('never keeps a frame bigger than the whole budget', () => {
    const onEvict = vi.fn();
    const cache = createFrameCache<string>({ budget: MB, onEvict });
    cache.put('a', 0, 1, 'huge', 2 * MB);

    expect(cache.get('a', 0.5)).toBeNull();
    expect(cache.bytes()).toBe(0);
    expect(onEvict).toHaveBeenCalledWith('huge');
  });

  it('replaces a frame stored at the same start', () => {
    const closed: string[] = [];
    const cache = createFrameCache<string>({ budget: 4 * MB, onEvict: (v) => closed.push(v) });
    cache.put('a', 0, 1, 'old', MB);
    cache.put('a', 0, 1, 'new', MB);

    expect(cache.get('a', 0.5)).toBe('new');
    expect(closed).toEqual(['old']);
    expect(cache.bytes()).toBe(MB);
  });

  it('reports contiguous cached runs, merging neighbours', () => {
    const cache = createFrameCache<string>({ budget: 10 * MB });
    [0, 1, 2, 5, 6].forEach((s) => cache.put('a', s, 1, `f${s}`, 1));

    expect(cache.runs('a')).toEqual([{ from: 0, to: 3 }, { from: 5, to: 7 }]);
    expect(cache.runs('none')).toEqual([]);
  });

  it('drops one key without touching the others', () => {
    const closed: string[] = [];
    const cache = createFrameCache<string>({ budget: 10 * MB, onEvict: (v) => closed.push(v) });
    cache.put('a', 0, 1, 'x', MB);
    cache.put('b', 0, 1, 'y', MB);
    cache.clear('a');

    expect(closed).toEqual(['x']);
    expect(cache.get('b', 0.5)).toBe('y');
    expect(cache.bytes()).toBe(MB);
  });
});
