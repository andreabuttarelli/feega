import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, sep } from 'node:path';

export type EditorEntry = { projectRoot: string; port: number; token: string; pid: number; lastActiveAt: number };

export type Want = { cwd: string; project?: string };

const EDITORS_DIR = join('.feega', 'editors');
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
const NO_EDITOR = 'No Feega editor is running. Open Feega in this project first: npx feega or the VS Code panel.';

const holds = (root: string, path: string) => path === root || path.startsWith(root + sep);

export function editorFor(entries: EditorEntry[], { cwd, project }: Want): EditorEntry | null {
  const target = project ?? cwd;
  const matching = entries.filter((e) => holds(e.projectRoot, target));

  return matching.sort((a, b) => b.projectRoot.length - a.projectRoot.length || b.lastActiveAt - a.lastActiveAt)[0] ?? null;
}

export const missingText = (entries: EditorEntry[]): string =>
  entries.length ? `${NO_EDITOR} Feega is open in ${[...new Set(entries.map((e) => e.projectRoot))].join(', ')}; pass project to pick one.` : NO_EDITOR;

export const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

export type EditorRegistry = { list: () => EditorEntry[]; save: (entry: EditorEntry) => void; drop: (entry: EditorEntry) => void };

type RegistryDeps = { dir?: string; alive?: (pid: number) => boolean };

const isEntry = (value: unknown): value is EditorEntry => {
  const e = value as EditorEntry;
  return typeof e?.projectRoot === 'string' && typeof e.port === 'number' && typeof e.token === 'string' && typeof e.pid === 'number' && typeof e.lastActiveAt === 'number';
};

export function editorRegistry({ dir = join(homedir(), EDITORS_DIR), alive = pidAlive }: RegistryDeps = {}): EditorRegistry {
  const fileOf = (entry: EditorEntry) => join(dir, `${entry.pid}-${entry.port}.json`);

  return {
    save: (entry) => {
      mkdirSync(dir, { recursive: true, mode: DIR_MODE });
      writeFileSync(fileOf(entry), JSON.stringify(entry), { mode: FILE_MODE });
    },
    drop: (entry) => rmSync(fileOf(entry), { force: true }),
    list: () => {
      const names = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];
      const found: EditorEntry[] = [];
      for (const name of names) {
        const file = join(dir, name);
        try {
          const entry: unknown = JSON.parse(readFileSync(file, 'utf8'));
          if (!isEntry(entry)) {
            continue;
          }
          if (!alive(entry.pid)) {
            rmSync(file, { force: true });
            continue;
          }
          found.push(entry);
        } catch {
          continue;
        }
      }
      return found;
    }
  };
}
