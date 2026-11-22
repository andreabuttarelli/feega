import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { COVERS_DIR, COVER_HEIGHT, COVER_WIDTH, docsPages } from '../src/docs-pages.mjs';

const PNG_WIDTH_AT = 16;
const HINT = 'run: node --experimental-transform-types landing/scripts/docs-covers.ts';

test('the docs have pages to cover', () => {
  assert.ok(docsPages().length > 0);
});

for (const { id, title } of docsPages()) {
  test(`${id} has a cover for cards and for social previews`, () => {
    assert.ok(title, `${id} has no title`);
    const png = resolve(COVERS_DIR, `${id}.png`);
    assert.ok(existsSync(png), `missing ${png}; ${HINT}`);
    assert.ok(existsSync(resolve(COVERS_DIR, `${id}.webp`)), `missing ${id}.webp; ${HINT}`);

    const bytes = readFileSync(png);
    assert.deepEqual([bytes.readUInt32BE(PNG_WIDTH_AT), bytes.readUInt32BE(PNG_WIDTH_AT + 4)], [COVER_WIDTH, COVER_HEIGHT]);
  });
}
