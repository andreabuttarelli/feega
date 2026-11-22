import { describe, expect, it } from 'vitest';
import { sitemapXml } from './sitemap';
import { SITE_PATHS } from './paths';

describe('sitemap', () => {
  it('lists every site path, one url per line', () => {
    const lines = sitemapXml().split('\n').filter((l) => l.includes('<url>'));
    expect(lines).toHaveLength(SITE_PATHS.length);
  });

  it('dates the articles with the day they were checked', () => {
    expect(sitemapXml()).toMatch(/\/alternatives\/[^<]+<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  });
});
