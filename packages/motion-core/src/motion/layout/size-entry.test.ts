import { describe, expect, it } from 'vitest';
import { Sizing } from './auto-layout';
import { formatSize, parseSize } from './size-entry';

describe('a typed size', () => {
  it.each([
    ['120', { sizing: Sizing.Fixed, value: 120 }],
    ['120px', { sizing: Sizing.Fixed, value: 120 }],
    ['50%', { sizing: Sizing.Percent, value: 50 }],
    ['2fr', { sizing: Sizing.Fill, value: 2 }],
    ['fill 3', { sizing: Sizing.Fill, value: 3 }],
    ['Fill', { sizing: Sizing.Fill, value: 1 }],
    ['hug', { sizing: Sizing.Hug }]
  ])('reads %s', (text, size) => {
    expect(parseSize(text)).toEqual(size);
  });

  it.each(['', 'abc', '-5%', '0fr', '500%'])('refuses %s', (text) => {
    expect(parseSize(text)).toBeNull();
  });

  it('writes back what it reads', () => {
    expect(formatSize({ sizing: Sizing.Fill, value: 2 })).toBe('Fill ×2');
    expect(formatSize({ sizing: Sizing.Percent, value: 50 })).toBe('50%');
    expect(formatSize({ sizing: Sizing.Hug })).toBe('Hug');
    expect(formatSize({ sizing: Sizing.Fixed, value: 120.4 })).toBe('120');
  });
});
