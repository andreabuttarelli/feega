import { describe, expect, it } from 'vitest';
import type { Use } from '$lib/motion/gpu-full/core-web';
import type { PathItem } from '$lib/motion/gpu-full/display-list';
import { SentOverlay, SentUses } from './use-diff';

describe('sent overlay', () => {
  it('counts a new array with the same items as unchanged', () => {
    const sent = new SentOverlay();
    const ring = { kind: 'path', clip: 'r', matrix: [1, 0, 0, 1, 0, 0] } as unknown as PathItem;

    expect(sent.changed([ring])).toBe(true);
    expect(sent.changed([{ ...ring }])).toBe(false);
    expect(sent.changed([{ ...ring, clip: 's' }])).toBe(true);
  });
});

const use = (clip: string, x = 0, cache = false): Use => ({ kind: 'use', clip, group: `${clip}:1`, matrix: [1, 0, 0, 1, x, 0], ...(cache ? { cache } : {}) });

describe('sent uses', () => {
  it('puts every use the first time', () => {
    expect(new SentUses().patch([use('a'), use('b')])).toEqual({ put: [use('a'), use('b')], drop: [] });
  });

  it('sends nothing when nothing changed', () => {
    const sent = new SentUses();
    sent.patch([use('a'), use('b')]);

    expect(sent.patch([use('a'), use('b')])).toBeNull();
  });

  it('puts only the use whose matrix or cache changed', () => {
    const sent = new SentUses();
    sent.patch([use('a'), use('b')]);

    expect(sent.patch([use('a', 5), use('b', 0, true)])).toEqual({ put: [use('a', 5), use('b', 0, true)], drop: [] });
    expect(sent.patch([use('a', 5), use('b', 0, true)])).toBeNull();
  });

  it('drops a use that left', () => {
    const sent = new SentUses();
    sent.patch([use('a'), use('b')]);

    expect(sent.patch([use('b')])).toEqual({ put: [], drop: ['a'] });
  });

  it('sends the stacking only when it changed', () => {
    const sent = new SentUses();
    sent.patch([use('a'), use('b')]);

    expect(sent.patch([use('b'), use('a')])).toEqual({ put: [], drop: [], order: ['b', 'a'] });
    expect(sent.patch([use('b'), use('a'), use('c')])).toEqual({ put: [use('c')], drop: [] });
  });
});
