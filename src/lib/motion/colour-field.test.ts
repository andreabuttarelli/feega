import { describe, expect, it } from 'vitest';
import { ColourFormat, channelsOf, colourLabel, fromChannels, parseColour, readRecent, remember, RECENT_MAX } from './colour-field';

function memory() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
}

describe('colour field', () => {
  const typed: [string, { colour: string; alpha: number | null }][] = [
    ['f', { colour: '#ffffff', alpha: null }],
    ['ff', { colour: '#ffffff', alpha: null }],
    ['fff', { colour: '#ffffff', alpha: null }],
    ['ffffff', { colour: '#ffffff', alpha: null }],
    ['#abc', { colour: '#aabbcc', alpha: null }],
    ['#3a', { colour: '#3a3a3a', alpha: null }],
    ['FF00AA', { colour: '#ff00aa', alpha: null }],
    [' #161616 ', { colour: '#161616', alpha: null }],
    ['f008', { colour: '#ff0000', alpha: 0.533 }],
    ['#ff000080', { colour: '#ff0000', alpha: 0.502 }],
    ['rgba(255, 0, 0, 0.5)', { colour: '#ff0000', alpha: 0.5 }],
    ['rgb(255 0 0)', { colour: '#ff0000', alpha: null }],
    ['rgb(0 128 255 / 25%)', { colour: '#0080ff', alpha: 0.25 }],
    ['255, 0, 0', { colour: '#ff0000', alpha: null }],
    ['255 0 0 50%', { colour: '#ff0000', alpha: 0.5 }],
    ['brand.text', { colour: 'brand.text', alpha: null }]
  ];

  it.each(typed)('reads %j as a colour', (text, expected) => {
    expect(parseColour(text)).toEqual(expected);
  });

  it.each(['red-ish', '#12345', '', 'ggg', 'rgb(256, 0, 0)', '255, 0', 'rgba(1, 2, 3, 2)', '1 2 3 4 5'])('refuses %j, so the field puts the old value back', (text) => {
    expect(parseColour(text)).toBeNull();
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

  it('shows a colour as editable channels in HEX, RGB or HSL', () => {
    expect(channelsOf('#ff0000', ColourFormat.Rgb)).toEqual([255, 0, 0]);
    expect(channelsOf('#ff0000', ColourFormat.Hsl)).toEqual([0, 100, 50]);
    expect(channelsOf('#336699', ColourFormat.Hex)).toEqual(['336699'.toUpperCase()]);
  });

  it('writes edited channels back as a hex, clamping each to its range', () => {
    expect(fromChannels(ColourFormat.Rgb, [0, 128, 300])).toBe('#0080ff');
    expect(fromChannels(ColourFormat.Hsl, [120, 100, 50])).toBe('#00ff00');
    expect(fromChannels(ColourFormat.Hex, ['abc'])).toBe('#aabbcc');
    expect(fromChannels(ColourFormat.Hex, ['nope'])).toBeNull();
  });

  it('round-trips a colour through HSL', () => {
    const hex = '#4f5a00';
    expect(fromChannels(ColourFormat.Hsl, channelsOf(hex, ColourFormat.Hsl) as number[])).toBe(hex);
  });
});
