import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureCopy } from './fixture-copy.mjs';

describe('a bench fixture copy', () => {
  it('leaves nothing in the temp folder once disposed', () => {
    const source = join(mkdtempSync(join(tmpdir(), 'fixture-src-')), 'a.feega');
    writeFileSync(source, 'x');

    const copy = fixtureCopy(source);
    expect(existsSync(copy.file)).toBe(true);

    copy.dispose();
    expect(existsSync(dirname(copy.file))).toBe(false);
  });
});
