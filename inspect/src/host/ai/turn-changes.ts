import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { promisify } from 'node:util';
import { SKIPPED_DIRS } from '../project-scan';

const run = promisify(execFile);

const MAX_FILE_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 64_000_000;
const MAX_GIT_OUTPUT = 64_000_000;
const BINARY_MARK = '\0';

export type TurnChange = { path: string; before: string; after: string };

export type TurnWatch = {
  begin: () => Promise<void>;
  wrote: (path: string, content: string) => void;
  settle: () => Promise<TurnChange[]>;
};

type Seen = { text: string; mtimeMs: number; size: number };

const visible = (path: string): boolean => !path.split('/').some((part) => SKIPPED_DIRS.has(part));

async function walked(root: string, dir = ''): Promise<string[]> {
  const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return SKIPPED_DIRS.has(entry.name) ? [] : walked(root, path);
      }
      return entry.isFile() ? [path] : [];
    })
  );
  return nested.flat();
}

async function listed(root: string): Promise<string[]> {
  const git = await run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, maxBuffer: MAX_GIT_OUTPUT }).catch(() => null);
  return git ? git.stdout.split('\0').filter(Boolean).filter(visible) : walked(root);
}

async function read(root: string, path: string, room: number): Promise<Seen | null> {
  const info = await stat(join(root, path)).catch(() => null);
  if (!info?.isFile() || info.size > Math.min(MAX_FILE_BYTES, room)) {
    return null;
  }
  const text = await readFile(join(root, path), 'utf8').catch(() => null);
  if (text === null || text.includes(BINARY_MARK)) {
    return null;
  }
  return { text, mtimeMs: info.mtimeMs, size: info.size };
}

export function turnWatch(root: string): TurnWatch {
  let baseline = new Map<string, Seen>();
  const wrote = new Map<string, string>();

  const begin = async () => {
    baseline = new Map();
    wrote.clear();
    let total = 0;
    for (const path of await listed(root)) {
      const seen = await read(root, path, MAX_TOTAL_BYTES - total);
      if (seen) {
        baseline.set(path, seen);
        total += seen.size;
      }
    }
  };

  const changeOf = async (path: string): Promise<TurnChange | null> => {
    const was = baseline.get(path);
    const info = await stat(join(root, path)).catch(() => null);
    if (was && info?.mtimeMs === was.mtimeMs && info.size === was.size) {
      return null;
    }
    const now = info ? await read(root, path, MAX_FILE_BYTES) : null;
    if (info && !now) {
      return null;
    }
    const after = now?.text ?? '';
    const before = wrote.get(path) ?? was?.text ?? '';
    return before === after ? null : { path, before, after };
  };

  const settle = async () => {
    const paths = new Set([...baseline.keys(), ...(await listed(root))]);
    const found = await Promise.all([...paths].sort().map(changeOf));
    return found.filter((change): change is TurnChange => change !== null);
  };

  return { begin, wrote: (path, content) => void wrote.set(path.split(sep).join('/'), content), settle };
}
