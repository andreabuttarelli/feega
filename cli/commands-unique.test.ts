import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CLI = readFileSync(new URL('./cli.ts', import.meta.url), 'utf8');

const namesOf = (source: string) => [...source.matchAll(/\bgithub\s*\.command\(\s*['`]([a-z-]+)/g)].map((m) => m[1]);
const loopNamesOf = (source: string) => [...source.matchAll(/\[\s*'([a-z-]+)',\s*'[a-z_]+',\s*'[^']*'\s*\]/g)].map((m) => m[1]);

describe('feega CLI', () => {
  it('nessun sottocomando di github ha lo stesso nome di un altro, o la CLI non parte', () => {
    const names = [...namesOf(CLI), ...loopNamesOf(CLI)];

    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });
});
