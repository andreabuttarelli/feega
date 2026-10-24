import { describe, expect, it } from 'vitest';
import { formatPadding, parsePadding } from './padding-text';

describe('padding shorthand', () => {
  it('one value pads every side', () => {
    expect(parsePadding('8')).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  it('two values are vertical then horizontal', () => {
    expect(parsePadding('8,16')).toEqual({ top: 8, right: 16, bottom: 8, left: 16 });
  });

  it('three values are top, horizontal, bottom', () => {
    expect(parsePadding('1 2 3')).toEqual({ top: 1, right: 2, bottom: 3, left: 2 });
  });

  it('four values run clockwise from the top', () => {
    expect(parsePadding('1, 2, 3, 4')).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
  });

  it('accepts px and rounds', () => {
    expect(parsePadding('8px 12.4px')).toEqual({ top: 8, right: 12, bottom: 8, left: 12 });
  });

  it('refuses nothing, words, negatives and five values', () => {
    expect(parsePadding('')).toBeNull();
    expect(parsePadding('wide')).toBeNull();
    expect(parsePadding('-4')).toBeNull();
    expect(parsePadding('1 2 3 4 5')).toBeNull();
  });

  it('writes the shortest form that reads back the same', () => {
    expect(formatPadding({ top: 8, right: 8, bottom: 8, left: 8 })).toBe('8');
    expect(formatPadding({ top: 8, right: 16, bottom: 8, left: 16 })).toBe('8 16');
    expect(formatPadding({ top: 1, right: 2, bottom: 3, left: 2 })).toBe('1 2 3');
    expect(formatPadding({ top: 1, right: 2, bottom: 3, left: 4 })).toBe('1 2 3 4');
  });
});
