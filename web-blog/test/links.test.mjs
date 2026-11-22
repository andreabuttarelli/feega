import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const DIST = resolve(import.meta.dirname, '../dist');
const SITE = 'https://blog.feega.app';

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      return htmlFiles(path);
    }
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function internalTargets(html) {
  return [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1].replace(SITE, ''))
    .filter((href) => href.startsWith('/') && !href.startsWith('//'))
    .map((href) => href.split('#')[0].split('?')[0])
    .filter(Boolean);
}

test('every internal link of the built blog resolves', () => {
  const broken = [];
  for (const file of htmlFiles(DIST)) {
    for (const target of internalTargets(readFileSync(file, 'utf8'))) {
      const path = resolve(DIST, `.${target}`);
      const found = existsSync(path) && (!target.endsWith('/') || existsSync(resolve(path, 'index.html')));
      if (!found) {
        broken.push(`${file.replace(DIST, '')} -> ${target}`);
      }
    }
  }
  assert.deepEqual(broken, []);
});
