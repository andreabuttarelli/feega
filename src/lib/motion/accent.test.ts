import { describe, expect, it } from 'vitest';
import { AccentSource, NEUTRAL_PALETTE, pickAccent } from './accent';

describe('pickAccent: the brand accent, never an invented one', () => {
  it('takes the first saturated colour, in the order logo, favicon, theme, buttons and links, custom properties', () => {
    const accent = pickAccent({ [AccentSource.Logo]: ['#FAFAF9', '#111111'], [AccentSource.Favicon]: ['#F2552F'], [AccentSource.Css]: ['#0055FF'] });

    expect(accent).toEqual({ hex: '#F2552F', source: AccentSource.Favicon, neutral: null });
  });

  it('skips near-white, near-black and greys', () => {
    const accent = pickAccent({ [AccentSource.Theme]: ['#FAFAF9', '#0A0A0A', '#8A8A8A', '#777B80'], [AccentSource.Buttons]: ['#1A6B4F'] });

    expect(accent.hex).toBe('#1A6B4F');
    expect(accent.source).toBe(AccentSource.Buttons);
  });

  it('gives no accent and the neutral palette when the brand has only neutrals', () => {
    const accent = pickAccent({ [AccentSource.Css]: ['#FAFAF9', '#1C1917'], [AccentSource.Logo]: ['#000000'] });

    expect(accent).toEqual({ hex: null, source: AccentSource.None, neutral: NEUTRAL_PALETTE });
  });
});
