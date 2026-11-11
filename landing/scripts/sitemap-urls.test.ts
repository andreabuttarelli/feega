import { expect, test } from 'vitest';
import { batches, sitemapUrls } from './sitemap-urls';

test('extracts every loc from a sitemap', () => {
  const xml = '<urlset><url><loc>https://feega.app/</loc></url><url><loc> https://feega.app/blog </loc></url></urlset>';
  expect(sitemapUrls(xml)).toEqual(['https://feega.app/', 'https://feega.app/blog']);
});

test('splits a list into batches of at most the given size', () => {
  expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});
