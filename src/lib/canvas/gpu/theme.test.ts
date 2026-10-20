import { describe, expect, it } from 'vitest';
import { mix } from './theme';

describe('theme colour mix', () => {
  it('blends two hex colours by share, without a renderer', () => {
    expect(mix('#6e6e73', '#ffffff', 0.45)).toBe('#bebec0');
    expect(mix('#a1a1a6', '#000000', 0.45)).toBe('#48484b');
  });

  it('keeps the first colour when one cannot be read', () => {
    expect(mix('oklch(0.5 0 0)', '#ffffff', 0.45)).toBe('oklch(0.5 0 0)');
  });
});
