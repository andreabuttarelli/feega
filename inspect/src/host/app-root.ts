import { dirname, join, relative, sep } from 'node:path';

export type Exists = (path: string) => Promise<boolean>;
export type Dirs = (path: string) => Promise<string[]>;
export type Tree = { has: Exists; dirs: Dirs };
export type AppChoice = { label: string; app: string };
export type ChooseApp = (apps: AppChoice[]) => Promise<string | null>;

const MANIFEST = 'package.json';
const SKIPPED = new Set(['node_modules', '.git', '.claude', 'dist', 'build', '.svelte-kit', '.next', '.output', '__fixtures__', 'fixtures']);
const DEPTH = 2;

export async function appRootOf(clicked: string, workspace: string, has: Exists): Promise<string | null> {
  for (let dir = clicked; dir.startsWith(workspace); dir = dirname(dir)) {
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

export async function chosenApp(start: string, workspace: string, tree: Tree, choose: ChooseApp): Promise<string | null> {
  const own = await appRootOf(start, workspace, tree.has);
  if (own) {
    return own;
  }
  const apps = await appsUnder(workspace, tree.has, tree.dirs);
  if (apps.length <= 1) {
    return apps[0] ?? null;
  }
  return choose(apps.map((app) => ({ label: relative(workspace, app).split(sep).join('/'), app })));
}
