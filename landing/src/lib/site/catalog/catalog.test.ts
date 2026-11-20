import { describe, expect, it } from 'vitest';
import { ALTERNATIVES } from '../alternatives';
import { HUBS } from '../topics';
import { articleOutline, topicOutline } from './outline';
import { slugify } from './slug';

describe('the catalog outline', () => {
  it('slugs a heading', () => {
    expect(slugify('Try it in 2 minutes')).toBe('try-it-in-2-minutes');
  });

  it.each(Object.entries(ALTERNATIVES))('%s has unique heading ids', (_, a) => {
    const ids = articleOutline(a).map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(HUBS.flatMap((h) => Object.entries(h.topics)))('topic %s has unique heading ids', (_, t) => {
    const ids = topicOutline(t).map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
