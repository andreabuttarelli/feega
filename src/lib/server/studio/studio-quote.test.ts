import { describe, expect, it } from 'vitest';
import { summarize, quoteIdOf } from './studio-quote';
import type { Quote } from './studio-batch';

const quote = {
  plan: { items: [{}, {}, {}], overLimit: false, skipped: [] },
  model: { credits: 4 },
  droppedRefs: 1
} as unknown as Quote;

describe('a quote summary', () => {
  it('counts the images and prices them', () => {
    expect(summarize(quote)).toEqual({ count: 3, overLimit: false, perImage: 4, total: 12, droppedRefs: 1, skipped: [] });
  });
});

describe('a quote id', () => {
  const selection = { name: 'Mugs', productIds: ['p'], modelIds: [], environments: ['white_ecom'], shots: ['packshot'], variations: 1, model: 'm', styleRefs: [], noPeopleConfirmed: false } as never;
  const summary = summarize(quote);

  it('is the same for the same selection and price', () => {
    expect(quoteIdOf(selection, summary)).toBe(quoteIdOf(selection, summary));
  });

  it('changes when the price or the selection does', () => {
    expect(quoteIdOf(selection, { ...summary, perImage: 5, total: 15 })).not.toBe(quoteIdOf(selection, summary));
    expect(quoteIdOf({ ...(selection as object), variations: 2 } as never, summary)).not.toBe(quoteIdOf(selection, summary));
  });
});
