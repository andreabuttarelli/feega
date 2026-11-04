import { describe, expect, it } from 'vitest';
import { COMPARISONS, isComparisonSlug } from '.';
import { FEEGA_FEATURES } from './feega';
import { Feature } from './features';
import { match } from '../../../params/comparison';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('the comparison pages', () => {
  it.each(Object.keys(COMPARISONS))('/blog/%s resolves to its page', (slug) => {
    expect(match(slug)).toBe(true);
  });

  it('an unknown slug stays a 404', () => {
    expect(isComparisonSlug('toString')).toBe(false);
  });

  it.each(Object.entries(COMPARISONS))('%s answers every feature row Feega answers', (_, page) => {
    expect(Object.keys(page.features).sort()).toEqual(Object.values(Feature).sort());
    expect(Object.keys(FEEGA_FEATURES).sort()).toEqual(Object.values(Feature).sort());
  });

  it.each(Object.entries(COMPARISONS))('%s says where the other tool wins, with sources and a date', (_, page) => {
    expect(page.theyWin.length).toBeGreaterThan(0);
    expect(page.sources.length).toBeGreaterThan(0);
    expect(page.checked).toMatch(ISO_DATE);
  });
});
