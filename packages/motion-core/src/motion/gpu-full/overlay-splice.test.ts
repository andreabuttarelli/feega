import { describe, expect, it } from 'vitest';
import { overlaySplice } from './overlay-splice';

const a = { clip: 'a' };
const b = { clip: 'b' };
const c = { clip: 'c' };
const d = { clip: 'd' };

describe('overlaySplice', () => {
  it('sends only what changed between the kept head and tail', () => {
    expect(overlaySplice([a, b, c], [a, d, c])).toEqual({ head: 1, tail: 1, items: [d] });
  });

  it('sends nothing to add when items only went away', () => {
    expect(overlaySplice([a, b, c], [a, c])).toEqual({ head: 1, tail: 1, items: [] });
  });

  it('keeps head and tail apart when the list repeats an item', () => {
    expect(overlaySplice([a, a], [a])).toEqual({ head: 1, tail: 0, items: [] });
  });

  it('has nothing to splice against before a first send', () => {
    expect(overlaySplice(null, [a])).toBeNull();
  });

  it('compares items by identity, not by content', () => {
    expect(overlaySplice([a], [{ clip: 'a' }])).toEqual({ head: 0, tail: 0, items: [{ clip: 'a' }] });
  });
});
