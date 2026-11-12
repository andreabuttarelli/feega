import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist');
const LANDING_STATIC = resolve(ROOT, '../landing/static');
const SHARED_IMAGE = 'https://feega.app/og.png';
const SHARED_VIDEO = 'https://feega.app/og.mp4';
const PNG_WIDTH_AT = 16;

const page = (path) => readFileSync(resolve(DIST, path, 'index.html'), 'utf8');
const meta = (html, property) => html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`))?.[1];
const subdirs = (path) => readdirSync(resolve(DIST, path), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `${path}/${d.name}`);

test('the shared preview files exist in the landing, at the declared size', () => {
  const png = readFileSync(resolve(LANDING_STATIC, 'og.png'));
  assert.deepEqual([png.readUInt32BE(PNG_WIDTH_AT), png.readUInt32BE(PNG_WIDTH_AT + 4)], [1200, 630]);
  assert.ok(existsSync(resolve(LANDING_STATIC, 'og.mp4')));
});

for (const path of ['.', 'tags', ...subdirs('tags')]) {
  test(`${path} shows the shared image and video`, () => {
    const html = page(path);
    assert.equal(meta(html, 'og:image'), SHARED_IMAGE);
    assert.equal(meta(html, 'twitter:image'), SHARED_IMAGE);
    assert.equal(meta(html, 'og:video'), SHARED_VIDEO);
    assert.equal(meta(html, 'og:image:width'), '1200');
    assert.equal(meta(html, 'og:image:height'), '630');
    assert.match(meta(html, 'og:image:alt'), /^Feega: Design inside your code/);
  });
}

for (const path of subdirs('posts')) {
  test(`${path} keeps its own cover and no video`, () => {
    const html = page(path);
    assert.match(meta(html, 'og:image'), /^https:\/\/blog\.feega\.app\/covers\/.+\.png$/);
    assert.equal(meta(html, 'og:video'), undefined);
    assert.ok(meta(html, 'og:image:alt'));
  });
}
