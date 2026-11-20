import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readBreakpoints, type Breakpoints } from '@feega/live-edit/breakpoints';

const CONFIGS = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs'];
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', '.output', 'coverage']);
const MAX_SHEETS = 200;
const MAX_DEPTH = 6;

const text = (path: string) => readFile(path, 'utf8').catch(() => null);

async function sheetsUnder(dir: string, depth: number, found: string[]): Promise<void> {
  if (depth > MAX_DEPTH || found.length >= MAX_SHEETS) {
    return;
  }
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) {
      await sheetsUnder(join(dir, entry.name), depth + 1, found);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.css') && !entry.name.endsWith('.min.css')) {
      found.push(join(dir, entry.name));
    }
  }
}

export async function breakpointsOf(root: string): Promise<Breakpoints> {
  const paths: string[] = [];
  await sheetsUnder(root, 0, paths);
  const sheets = (await Promise.all(paths.slice(0, MAX_SHEETS).map(text))).filter((t): t is string => t !== null);
  const configs = await Promise.all(CONFIGS.map((name) => text(join(root, name))));
  return readBreakpoints({ tailwindConfig: configs.find((c) => c !== null) ?? null, sheets });
}
