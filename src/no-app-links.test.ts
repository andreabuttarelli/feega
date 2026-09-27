import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');
const SOURCE_FILE = /\.(ts|svelte)$/;
const TEST_FILE = /\.test\.ts$/;
const APP_LITERAL = /['"]\/app['"?#]/;

const MATCHES_PATH_NOT_LINK = new Set([
  'hooks.client.ts',
  'hooks.server.ts',
  'routes/+layout.svelte',
  'lib/server/agent-team-public.ts'
]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sources(path);
    }
    return SOURCE_FILE.test(name) && !TEST_FILE.test(name) ? [path] : [];
  });
}

describe('/app è solo un 308 per i vecchi segnalibri', () => {
  it('nessun sorgente ci manda o ci linka', () => {
    const offenders = sources(SRC)
      .map((path) => relative(SRC, path))
      .filter((path) => !MATCHES_PATH_NOT_LINK.has(path))
      .filter((path) => APP_LITERAL.test(readFileSync(join(SRC, path), 'utf8')));

    expect(offenders).toEqual([]);
  });
});
