import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { TYPE_GRID_POSTER_TEMPLATE } from './type-grid-poster/template';

const FIXTURE = 'tests/e2e/fixtures/poster-type-grid.json';

describe('the poster the e2e edits on the canvas', () => {
  it('is the type grid template as it ships, not a stale copy', () => {
    const doc = JSON.parse(JSON.stringify(TYPE_GRID_POSTER_TEMPLATE.template.doc));
    if (process.env.WRITE_FIXTURES) {
      writeFileSync(FIXTURE, JSON.stringify(doc));
    }
    expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(doc);
  });
});
