import { readFile } from 'node:fs/promises';
import { posix, relative, sep } from 'node:path';
import { isEntry, isPage } from './entry-files';
import { nameOf } from './impact';
import { scanProject } from './project-scan';
import { componentNames } from './usages';

export type ComponentRow = { name: string; file: string; folder: string; uses: number };

type Source = { path: string; text: string };

type Found = { name: string; file: string };

const MAX_SOURCES = 5000;
const ROOT_DIR = 'src';
const NOT_A_COMPONENT = /\.(test|spec|stories)\.[jt]sx?$|(^|\/)__tests__\//;
const RENDERS_MARKUP = /<[A-Za-z][\w.]*[\s/>]|createElement\(|jsxs?\(/;
const DEFAULT_NAME = 'default';

const posixOf = (path: string) => path.split(sep).join('/');

export function componentsOf(sources: Source[]): Found[] {
  return sources
    .filter(({ path }) => !isPage(path) && !isEntry(path) && !NOT_A_COMPONENT.test(path))
    .flatMap(({ path, text }) => {
      const names = componentNames(path, text);
      if (!names || (/\.[jt]sx$/.test(path) && !RENDERS_MARKUP.test(text))) {
        return [];
      }
      return [...names].map((name) => ({ name: name === DEFAULT_NAME ? nameOf(path) : name, file: path }));
    });
}

export function folderOf(file: string): string {
  const dir = posix.dirname(file);
  const inside = dir === ROOT_DIR ? '' : dir.replace(new RegExp(`^${ROOT_DIR}/`), '');

  return inside === '.' ? '' : inside;
}

const byFolderThenName = (a: ComponentRow, b: ComponentRow) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name);

export async function listComponents(appRoot: string, usesOf: (file: string) => Promise<number>): Promise<ComponentRow[]> {
  const scan = await scanProject(appRoot, MAX_SOURCES);
  const sources = await Promise.all(
    scan.sources.map(async (full) => {
      const path = posixOf(relative(appRoot, full));
      return { path, text: await readFile(full, 'utf8').catch(() => '') };
    })
  );
  const found = componentsOf(sources);
  const uses = new Map<string, number>();
  for (const { file } of found) {
    uses.set(file, uses.get(file) ?? (await usesOf(file)));
  }

  return found.map(({ name, file }) => ({ name, file, folder: folderOf(file), uses: uses.get(file) ?? 0 })).sort(byFolderThenName);
}
