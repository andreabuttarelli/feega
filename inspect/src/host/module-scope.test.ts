import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Scopes } from './module-scope';

describe('Scopes', () => {
  it('gives up on a value that refers to itself', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feega-scope-'));
    const text = 'const a = [b];\nconst b = [a];\nconst c = { c };';
    writeFileSync(join(root, 'x.ts'), text);
    const lookup = await new Scopes(root).lookup('x.ts', text, 0, ['x.ts']);

    expect(lookup('a')).toEqual([[]]);
    expect(lookup('c')).toEqual({});
  });
});
