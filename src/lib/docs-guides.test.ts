import { describe, expect, test } from 'vitest';
import { DOCS_ORIGIN, fetchGuides, filterGuides, guideUrl, parseGuides } from './docs-guides';

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

describe('fetchGuides', () => {
  const answer = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

  test('restituisce le guide di una risposta valida', async () => {
    await expect(fetchGuides(answer(SAMPLE))).resolves.toEqual(SAMPLE);
  });

  test('una risposta di errore fa fallire, così la tab dice che è offline', async () => {
    await expect(fetchGuides(answer({ error: 'not found' }, false))).rejects.toThrow();
  });

  test('un indice vuoto o senza guide valide fa fallire invece di mostrare una tab vuota', async () => {
    await expect(fetchGuides(answer([]))).rejects.toThrow();
    await expect(fetchGuides(answer({ not: 'an array' }))).rejects.toThrow();
  });
});
