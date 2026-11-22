import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const DIST = resolve(import.meta.dirname, '../dist');
const ARCHIVED = ['rust-canvas-renderer', 'how-the-canvas-got-fast'];
const BANNER = 'This post describes an earlier version of Feega that no longer exists.';

const read = (path) => readFileSync(resolve(DIST, path), 'utf8');

for (const slug of ARCHIVED) {
  test(`${slug} stays reachable, says it is old and is noindex`, () => {
    const html = read(`posts/${slug}/index.html`);
    assert.ok(html.includes(BANNER));
    assert.match(html, /<meta name="robots" content="noindex/);
  });

  test(`${slug} is left out of the index, the feed, the sitemap and the tags`, () => {
    const listings = [read('index.html'), read('rss.xml'), read('sitemap-0.xml'), read('tags/index.html')];
    for (const listing of listings) {
      assert.ok(!listing.includes(`/posts/${slug}/`));
    }
    for (const tag of ['rust', 'webgpu', 'performance', 'engineering']) {
      const page = `tags/${tag}/index.html`;
      assert.ok(!existsSync(resolve(DIST, page)) || !read(page).includes(`/posts/${slug}/`));
    }
  });
}

test('current posts are indexable and carry no banner', () => {
  const html = read('posts/introducing-feega/index.html');
  assert.ok(!html.includes(BANNER));
  assert.ok(!html.includes('noindex'));
});

test('the introduction says when it was updated', () => {
  assert.ok(read('posts/introducing-feega/index.html').includes('Updated 22 November 2026'));
});

test('no page of the blog describes the earlier product as current', () => {
  const OLD_CLAIMS = [/one canvas for design, motion and AI/i, /image and video nodes/i, /motion engine/i];
  for (const path of ['index.html', 'posts/introducing-feega/index.html', 'rss.xml']) {
    for (const claim of OLD_CLAIMS) {
      assert.doesNotMatch(read(path), claim);
    }
  }
});
