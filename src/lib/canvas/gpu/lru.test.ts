import { describe, expect, it } from 'vitest';
import { createLru } from './lru';

describe('createLru — a byte budget that evicts the least recently used', () => {
  it('evicts the oldest entries once over budget, and calls their release', () => {
    const released: string[] = [];
    const lru = createLru<string>(100, (_k, v) => released.push(v));
    lru.set('a', 'A', 40);
    lru.set('b', 'B', 40);
    lru.get('a');
    lru.set('c', 'C', 40);
    expect(released).toEqual(['B']);
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('a')).toBe('A');
    expect(lru.bytes).toBe(80);
  });

  it('never evicts what was just inserted, even if it alone is over budget', () => {
    const lru = createLru<string>(10, () => {});
    lru.set('big', 'X', 50);
    expect(lru.get('big')).toBe('X');
  });

  it('never evicts an entry still on screen, and evicts it once it is let go', () => {
    const released: string[] = [];
    const shown = new Set(['a']);
    const lru = createLru<string>(100, (_k, v) => released.push(v), (k) => shown.has(k));
    lru.set('a', 'A', 60);
    lru.set('b', 'B', 60);
    expect(released).toEqual([]);
    expect(lru.get('a')).toBe('A');
    shown.delete('a');
    lru.set('c', 'C', 60);
    expect(released).toContain('A');
  });
});
