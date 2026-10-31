import { describe, expect, it } from 'vitest';
import { textBaseline, textExtent } from './text-extent';

describe('textBaseline', () => {
  it('sits an ascent below the top, plus half the extra leading', () => {
    expect(textBaseline('Text', { size: 0.1, leading: 1.2 }, 100)).toBeCloseTo(1 + 8, 5);
  });

  it('adds the caption inset', () => {
    expect(textBaseline('Caption', { size: 0.1, leading: 1 }, 100)).toBeCloseTo(2.5 + 8, 5);
  });
});

describe('textExtent', () => {
  const INTER_BOLD_NEW = 28.5;
  const INTER_MEDIUM_COPY = 236.8;
  const TOLERANCE = 0.05;

  it('hugs a short wide word close to its real width, so a gap after it stays visible', () => {
    const { width } = textExtent('Text', { text: 'New', size: 13, leading: 1 }, 1);
    expect(Math.abs(width - INTER_BOLD_NEW) / INTER_BOLD_NEW).toBeLessThan(TOLERANCE);
  });

  it('does not overestimate a sentence of narrow letters', () => {
    const { width } = textExtent('Text', { text: 'Multi-entity close is live for every plan', size: 13, leading: 1 }, 1);
    expect(Math.abs(width - INTER_MEDIUM_COPY) / INTER_MEDIUM_COPY).toBeLessThan(TOLERANCE);
  });
});

describe('textExtent line height', () => {
  it('a line height in pixels sets the height of a hugging line', () => {
    expect(textExtent('Text', { text: 'One line', size: 15, lineHeight: '24px' }, 1).height).toBeCloseTo(24, 5);
  });
});
