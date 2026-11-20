import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, dirsFor } from './targets.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');

describe('site-theme', () => {
  for (const source of SOURCES) {
    for (const dir of dirsFor(source)) {
      it(`${dir}/${source} matches packages/site-theme (run node packages/site-theme/sync.mjs)`, () => {
        const copy = readFileSync(join(ROOT, dir, source), 'utf8');
        expect(copy).toBe(readFileSync(join(HERE, source), 'utf8'));
      });
    }
  }
});
