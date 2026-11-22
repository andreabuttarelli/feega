import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist');
const URL_BLOCK = /<url>[\s\S]*?<\/url>/g;
const REDIRECT = { source: '/sitemap.xml', destination: '/sitemap-index.xml', permanent: true };

test('/sitemap.xml permanently redirects to the sitemap index', () => {
  const { redirects = [] } = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
  assert.ok(redirects.some((r) => JSON.stringify(r) === JSON.stringify(REDIRECT)));
});

test('every URL in the sitemap has a lastmod', () => {
  const urls = readFileSync(resolve(DIST, 'sitemap-0.xml'), 'utf8').match(URL_BLOCK) ?? [];
  assert.ok(urls.length > 0);
  for (const url of urls) {
    assert.match(url, /<lastmod>\d{4}-\d{2}-\d{2}/);
  }
});

test('a post lastmod is its updated date, not its publish date', () => {
  const sitemap = readFileSync(resolve(DIST, 'sitemap-0.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/blog\.feega\.app\/posts\/introducing-feega\/<\/loc><lastmod>2026-11-22/);
});
