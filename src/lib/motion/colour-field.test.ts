import { describe, expect, it } from 'vitest';
import { ColourFormat, alphaOfText, channelsOf, colourLabel, fromChannels, hexOfHsb, hsbOfHex, nudge, parseColour, percentOfAlpha, readRecent, remember, snap, unitAt, RECENT_MAX } from './colour-field';

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

  const sample = Array.from({ length: 343 }, (_, i) => {
    const level = (n: number) => Math.min(255, n * 43);
    return `#${[Math.floor(i / 49), Math.floor(i / 7) % 7, i % 7].map((n) => level(n).toString(16).padStart(2, '0')).join('')}`;
  });

  it.each([ColourFormat.Rgb, ColourFormat.Hsl])('round-trips every sampled colour through %s channels', (format) => {
    for (const hex of sample) {
      const channels = channelsOf(hex, format);
      expect(fromChannels(format, channels)).toBe(hex);
    }
  });

  it('reads a colour as HSB and writes it back without loss', () => {
    expect(hsbOfHex('#ff0000')).toEqual({ h: 0, s: 100, b: 100 });
    expect(hsbOfHex('#000000')).toEqual({ h: 0, s: 0, b: 0 });
    expect(hsbOfHex('#808080').s).toBe(0);
    for (const hex of sample) {
      expect(hexOfHsb(hsbOfHex(hex))).toBe(hex);
    }
  });

  it('shows HSB as whole numbers', () => {
    expect(channelsOf('#336699', ColourFormat.Hsb)).toEqual([210, 67, 60]);
  });

  it('keeps the hue when saturation or brightness reaches zero', () => {
    expect(hexOfHsb({ h: 200, s: 0, b: 50 })).toBe('#808080');
    expect(hexOfHsb({ h: 200, s: 50, b: 0 })).toBe('#000000');
  });

  it('turns a position along a track into a 0..1 value, clamped', () => {
    expect(unitAt(50, 100)).toBe(0.5);
    expect(unitAt(-20, 100)).toBe(0);
    expect(unitAt(140, 100)).toBe(1);
    expect(unitAt(10, 0)).toBe(0);
  });

  it('reads the opacity field as a percent and shows alpha as a percent', () => {
    expect(alphaOfText('50')).toBe(0.5);
    expect(alphaOfText('50%')).toBe(0.5);
    expect(alphaOfText('150')).toBe(1);
    expect(alphaOfText('-3')).toBe(0);
    expect(alphaOfText('abc')).toBeNull();
    expect(percentOfAlpha(0.502)).toBe(50);
    expect(percentOfAlpha(1)).toBe(100);
  });

  it('snaps to a step and nudges within a range', () => {
    expect(snap(13, 5)).toBe(15);
    expect(snap(12, 5)).toBe(10);
    expect(nudge(99, 1, 100)).toBe(100);
    expect(nudge(1, -5, 100)).toBe(0);
    expect(nudge(50, 1, 100)).toBe(51);
  });
});
