import { describe, expect, it } from 'vitest';
import { colourLabel, parseColour, readRecent, remember, RECENT_MAX } from './colour-field';

function memory() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
}

describe('colour field', () => {
  it('reads a typed hex with or without #, short or long, and a brand token', () => {
    expect(parseColour('FF00AA')).toBe('#ff00aa');
    expect(parseColour('#f0a')).toBe('#ff00aa');
    expect(parseColour(' #161616 ')).toBe('#161616');
    expect(parseColour('brand.text')).toBe('brand.text');
  });

  it('refuses anything that is not a colour, so the field puts the old value back', () => {
    expect(parseColour('red-ish')).toBeNull();
    expect(parseColour('#12345')).toBeNull();
    expect(parseColour('')).toBeNull();
  });

  it('shows a hex as six capitals and a token by its name', () => {
    expect(colourLabel('#ff00aa')).toBe('FF00AA');
    expect(colourLabel('brand.primary')).toBe('Brand primary');
  });

  it('remembers the last colours used, newest first, never twice, at most a row', () => {
    const store = memory();
    let recent = readRecent(store);
    for (const hex of ['#111111', '#222222', '#111111']) {
      recent = remember(recent, hex, store);
    }

    expect(recent).toEqual(['#111111', '#222222']);
    expect(readRecent(store)).toEqual(recent);
    const many = Array.from({ length: 20 }, (_, i) => `#0000${String(i).padStart(2, '0')}`);
    expect(many.reduce((list, hex) => remember(list, hex, null), [] as string[])).toHaveLength(RECENT_MAX);
  });

  it('a broken store gives an empty list instead of throwing', () => {
    expect(readRecent({ getItem: () => '{nope', setItem: () => {} })).toEqual([]);
    expect(readRecent(null)).toEqual([]);
  });
});
