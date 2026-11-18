import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = new URL('.', import.meta.url).pathname;
const STATIC_PLAYWRIGHT = /(from|import\()\s*['"]playwright['"]/;

describe('il bundle del server non nomina playwright', () => {
  it('nessun import letterale: adapter-node lo impacchetta e fsevents.node rompe build:node', () => {
    const sources = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const offenders = sources.filter((f) => STATIC_PLAYWRIGHT.test(readFileSync(join(DIR, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
