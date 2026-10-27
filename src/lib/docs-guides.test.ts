import { describe, expect, test } from 'vitest';
import { DOCS_ORIGIN, filterGuides, guideUrl, parseGuides } from './docs-guides';

const SAMPLE = [
  { path: 'ai/loops', title: 'Loops', section: 'ai' },
  { path: 'canvas/create-a-post', title: 'Create a post', section: 'canvas' }
];

describe('guide dai docs', () => {
  test('parseGuides scarta le voci malformate', () => {
    expect(parseGuides([...SAMPLE, { path: 1 }, null, 'x'])).toEqual(SAMPLE);
    expect(parseGuides({ not: 'an array' })).toEqual([]);
  });

  test('filterGuides cerca nel titolo senza badare alle maiuscole', () => {
    expect(filterGuides(SAMPLE, ' POST ')).toEqual([SAMPLE[1]]);
    expect(filterGuides(SAMPLE, '')).toEqual(SAMPLE);
  });

  test('guideUrl punta alla pagina dei docs', () => {
    expect(guideUrl('ai/loops')).toBe(`${DOCS_ORIGIN}/ai/loops/`);
  });
});
