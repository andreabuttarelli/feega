import { describe, expect, it } from 'vitest';
import { summarize } from './studio-quote';
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
