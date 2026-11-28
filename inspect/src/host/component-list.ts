import { readFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { PropsSource } from '../props-source';
import { isEntry, isPage } from './entry-files';
import { nameOf } from './impact';
import { scanProject } from './project-scan';
import { componentNames } from './usages';
import { literalPropsOf, type LiteralProps } from './usage-props';

export type PropsSample = { props: LiteralProps; source: PropsSource };

export type ComponentRow = { name: string; file: string; folder: string; uses: number; sample?: PropsSample };

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

const MAX_USERS_READ = 8;

async function sampleOf(appRoot: string, name: string, users: string[]): Promise<PropsSample | undefined> {
  for (const user of users.slice(0, MAX_USERS_READ)) {
    const props = literalPropsOf(await readFile(join(appRoot, user), 'utf8').catch(() => ''), name);
    if (props) {
      return { props, source: PropsSource.Code };
    }
  }

  return undefined;
}

export async function listComponents(appRoot: string, usersOf: (file: string) => Promise<string[]>): Promise<ComponentRow[]> {
  const scan = await scanProject(appRoot, MAX_SOURCES);
  const sources = await Promise.all(
    scan.sources.map(async (full) => {
      const path = posixOf(relative(appRoot, full));
      return { path, text: await readFile(full, 'utf8').catch(() => '') };
    })
  );
  const found = componentsOf(sources);
  const users = new Map<string, string[]>();
  for (const { file } of found) {
    users.set(file, users.get(file) ?? (await usersOf(file)));
  }
  const rows = await Promise.all(
    found.map(async ({ name, file }) => {
      const sample = await sampleOf(appRoot, name, users.get(file) ?? []);
      return { name, file, folder: folderOf(file), uses: users.get(file)?.length ?? 0, ...(sample && { sample }) };
    })
  );

  return rows.sort(byFolderThenName);
}
