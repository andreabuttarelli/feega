import { expect, test } from 'vitest';
import { batches, isSitemapIndex, onHost, sitemapUrls } from './sitemap-urls';

test('extracts every loc from a sitemap', () => {
  const xml = '<urlset><url><loc>https://feega.app/</loc></url><url><loc> https://feega.app/blog </loc></url></urlset>';
  expect(sitemapUrls(xml)).toEqual(['https://feega.app/', 'https://feega.app/blog']);
});

test('splits a list into batches of at most the given size', () => {
  expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

const INDEX = `<sitemapindex>
<sitemap><loc>https://blog.feega.app/sitemap-0.xml</loc></sitemap>
<sitemap><loc>https://blog.feega.app/sitemap-1.xml</loc></sitemap>
</sitemapindex>`;

const URLSET = '<urlset><url><loc>https://blog.feega.app/a</loc></url></urlset>';

test('tells a sitemap index from a urlset', () => {
  expect(isSitemapIndex(INDEX)).toBe(true);
  expect(isSitemapIndex(URLSET)).toBe(false);
});

test('an index lists its child sitemaps', () => {
  expect(sitemapUrls(INDEX)).toEqual(['https://blog.feega.app/sitemap-0.xml', 'https://blog.feega.app/sitemap-1.xml']);
});

test('keeps only urls on the host', () => {
  const urls = ['https://feega.app/a', 'https://blog.feega.app/b', 'https://evil.example/feega.app', 'not a url'];
  expect(onHost(urls, 'feega.app')).toEqual(['https://feega.app/a']);
});
