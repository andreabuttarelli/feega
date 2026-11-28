import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', '.output', 'coverage']);
const SOURCE_FILE = /\.(tsx|jsx|ts|js|svelte|vue|astro|html)$/;
const MAX_FILES = 200;
const MAX_DEPTH = 6;

export type Scan = { sheets: string[]; sources: string[] };

const isSheet = (name: string) => name.endsWith('.css') && !name.endsWith('.min.css');

const isSource = (name: string) => SOURCE_FILE.test(name) && !name.endsWith('.d.ts') && !name.endsWith('.min.js');

async function walk(dir: string, depth: number, found: Scan, max: number): Promise<void> {
  if (depth > MAX_DEPTH) {
    return;
  }
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) {
      await walk(path, depth + 1, found, max);
      continue;
    }
    if (entry.isFile() && isSheet(entry.name) && found.sheets.length < max) {
      found.sheets.push(path);
    }
    if (entry.isFile() && isSource(entry.name) && found.sources.length < max) {
      found.sources.push(path);
    }
  }
}

export async function scanProject(root: string, max = MAX_FILES): Promise<Scan> {
  const found: Scan = { sheets: [], sources: [] };
  await walk(root, 0, found, max);
  return found;
}

const FILE_DEPTH = 10;

async function collect(dir: string, depth: number, accept: RegExp, found: string[], max: number): Promise<void> {
  if (depth > FILE_DEPTH || found.length >= max) {
    return;
  }
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) {
      await collect(path, depth + 1, accept, found, max);
    }
    if (entry.isFile() && accept.test(entry.name) && found.length < max) {
      found.push(path);
    }
  }
}

export async function listFiles(root: string, accept: RegExp, max: number): Promise<string[]> {
  const found: string[] = [];
  await collect(root, 0, accept, found, max);

  return found;
}
