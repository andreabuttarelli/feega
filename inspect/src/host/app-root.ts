import { dirname, extname, join } from 'node:path';

export type Exists = (path: string) => Promise<boolean>;
export type Dirs = (path: string) => Promise<string[]>;

const MANIFEST = 'package.json';
const SKIPPED = new Set(['node_modules', '.git', '.claude', 'dist', 'build', '.svelte-kit', '.next', '.output', '__fixtures__', 'fixtures']);
const DEPTH = 2;

export async function appRootOf(clicked: string, workspace: string, has: Exists): Promise<string | null> {
  for (let dir = extname(clicked) ? dirname(clicked) : clicked; dir.startsWith(workspace); dir = dirname(dir)) {
    if (await has(join(dir, MANIFEST))) {
      return dir;
    }
    if (dir === workspace) {
      return null;
    }
  }
  return null;
}

export async function appsUnder(root: string, has: Exists, dirs: Dirs, depth = DEPTH): Promise<string[]> {
  if (!depth) {
    return [];
  }
  const found: string[] = [];
  for (const name of (await dirs(root)).filter((n) => !SKIPPED.has(n)).sort()) {
    const dir = join(root, name);
    if (await has(join(dir, MANIFEST))) {
      found.push(dir);
      continue;
    }
    found.push(...(await appsUnder(dir, has, dirs, depth - 1)));
  }
  return found;
}
