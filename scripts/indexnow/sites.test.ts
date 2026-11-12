import { expect, test } from 'vitest';
import { SITES } from './sites';

test('every site keeps its sitemap on its own host', () => {
  for (const site of Object.values(SITES)) {
    expect(new URL(site.sitemap).host).toBe(site.host);
  }
});

test('the three production sites are listed by deploy project', () => {
  expect(Object.keys(SITES).sort()).toEqual(['feega-landing', 'web-blog', 'web-docs']);
});
