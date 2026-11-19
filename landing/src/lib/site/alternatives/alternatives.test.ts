import { describe, expect, it } from 'vitest';
import { ALTERNATIVES, isAlternativeSlug } from '.';
import { match } from '../../../params/alternative';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('the alternative articles', () => {
  it.each(Object.keys(ALTERNATIVES))('/alternatives/%s resolves to its page', (slug) => {
    expect(match(slug)).toBe(true);
  });

  it('an unknown slug stays a 404', () => {
    expect(isAlternativeSlug('toString')).toBe(false);
  });

  it.each(Object.entries(ALTERNATIVES))('%s says when to pick the other tool, with sources and a date', (_, a) => {
    expect(a.pickThem.points.length).toBeGreaterThan(0);
    expect(a.sources.length).toBeGreaterThan(0);
    expect(a.checked).toMatch(ISO_DATE);
  });
});
