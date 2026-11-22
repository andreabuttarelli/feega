import { readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_ENTRIES = 40;
export const MAX_LINE_LENGTH = 90;

const CHANGELOG_DIR = fileURLToPath(new URL('../src/lib/content/changelog', import.meta.url));
const ENTRY_FILE = /^\d{4}-\d{2}-\d{2}-.+\.ts$/;
const TEST_FILE = /\.test\.ts$/;

export function entryNames(dir = CHANGELOG_DIR) {
  return readdirSync(dir)
    .filter((name) => ENTRY_FILE.test(name) && !TEST_FILE.test(name))
    .sort()
    .reverse();
}

export function pruneOldest(dir = CHANGELOG_DIR, max = MAX_ENTRIES) {
  const doomed = entryNames(dir).slice(max);
  for (const name of doomed) {
    rmSync(join(dir, name));
  }
  return doomed;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const removed = pruneOldest();
  console.log(`changelog: removed ${removed.length} oldest entries`);
}
