import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCANNED_ROOTS = ['src/lib', 'src/routes', 'cli', 'docs'];
const SKIPPED_DIRS = new Set(['node_modules', 'changelog', 'dist']);
const SCANNED_FILE = /\.(ts|svelte|json|md|txt)$/;
const GOOGLE_ADS = /googleads|google[ _-]?ads|ads\/google|channel\.google/i;
const THIS_FILE = 'src/lib/no-google-ads.test.ts';

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRS.has(entry.name)) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...filesUnder(full));
      continue;
    }
    if (SCANNED_FILE.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('Google Ads is gone from the product', () => {
  it('no source, CLI or doc file mentions a Google ads channel', () => {
    const offenders = SCANNED_ROOTS.flatMap((root) => filesUnder(join(REPO_ROOT, root)))
      .map((file) => relative(REPO_ROOT, file))
      .filter((file) => file !== THIS_FILE)
      .filter((file) => GOOGLE_ADS.test(readFileSync(join(REPO_ROOT, file), 'utf8')));

    expect(offenders).toEqual([]);
  });
});
