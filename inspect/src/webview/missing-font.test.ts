import { describe, expect, it } from 'vitest';
import type { MissingFont } from '../messages';
import { missingIn, noticeText, offeredAction, FontAction } from './missing-font';
import { installedAmong } from './system-fonts';
import { fontCss, GOOGLE_FONTS } from './fonts';

const brandon: MissingFont = { family: 'Brandon', fallback: 'sans-serif', declared: false };
const inter: MissingFont = { family: 'Inter', fallback: 'system-ui', declared: false };

describe('missingIn', () => {
  it('finds the missing family named first in the computed stack of the element', () => {
    expect(missingIn('"Brandon", Arial, sans-serif', [inter, brandon])).toEqual(brandon);
  });

  it('is case-insensitive like CSS', () => {
    expect(missingIn('brandon, serif', [brandon])).toEqual(brandon);
  });

  it('finds nothing when the stack names no missing family', () => {
    expect(missingIn('Arial, sans-serif', [brandon])).toBeNull();
  });
});

describe('noticeText', () => {
  it('says what is wrong and what the text falls back to', () => {
    expect(noticeText(brandon)).toBe("Brandon isn't installed or loaded. Text falls back to sans-serif.");
  });
});

describe('offeredAction', () => {
  it('offers loading from Google Fonts when the family is there and the page does not declare it', () => {
    expect(offeredAction(inter)).toBe(FontAction.LoadFromGoogle);
  });

  it('offers only a replacement for a family that is not on Google Fonts', () => {
    expect(offeredAction(brandon)).toBe(FontAction.ReplaceOnly);
  });

  it('offers only a replacement when the page declares the family and its file failed', () => {
    expect(offeredAction({ ...inter, declared: true })).toBe(FontAction.ReplaceOnly);
  });
});

describe('installedAmong', () => {
  const have = new Set(['Arial', 'Georgia']);
  const measure = (family: string) => (have.has(family) ? 'wide' : 'plain');

  it('keeps the candidates whose metrics differ from the unknown-font fallback', () => {
    expect(installedAmong(['Arial', 'Nope', 'Georgia'], measure)).toEqual(['Arial', 'Georgia']);
  });
});

describe('the Google Fonts list', () => {
  it('carries the whole catalogue with a category', () => {
    expect(GOOGLE_FONTS.length).toBeGreaterThan(1500);
    expect(GOOGLE_FONTS.find((f) => f.family === 'Inter')?.category).toBe('sans-serif');
  });

  it('falls back to the family kind of the font', () => {
    expect(fontCss('JetBrains Mono')).toBe("'JetBrains Mono', monospace");
    expect(fontCss('Playfair Display')).toBe("'Playfair Display', serif");
    expect(fontCss('Unknown Thing')).toBe("'Unknown Thing', sans-serif");
  });
});
