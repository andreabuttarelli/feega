import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { openTagEnd, offsetOf } from '@feega/live-edit/class-patch';
import { buildIndex, entryOf, factsOf, type ClassEntry, type ClassIndex, type FileFacts } from '@feega/live-edit/class-index';
import { classUsesOf } from '@feega/live-edit/class-uses';
import { inside, liveAtOf, reader } from '@feega/live-edit/live-ask';
import type { ClassTarget } from '@feega/live-edit/class-rule';
import type { ClassesView, ClassInfo } from '../messages';
import { relativeOf, type Watch } from './file-watch';
import { scanProject } from './project-scan';

const MAX_SITES = 300;
const SAFETY_TTL_MS = 5 * 60_000;

type Seen = { mtime: number; facts: FileFacts };

type Options = { now?: () => number; watch?: Watch };

export function classIndex(root: string, { now = Date.now, watch }: Options = {}) {
  const seen = new Map<string, Seen>();
  let built: Promise<ClassIndex> | null = null;
  let builtAt = 0;
  let reads = 0;
  let watching: { dispose: () => void } | null = null;

  const invalidate = () => {
    built = null;
  };

  async function refresh(): Promise<ClassIndex> {
    const { sheets, sources } = await scanProject(root, Infinity);
    const names = new Set([...sheets, ...sources].map((full) => relativeOf(root, full)));
    for (const name of [...seen.keys()]) {
      if (!names.has(name)) {
        seen.delete(name);
      }
    }
    await Promise.all(
      [...names].map(async (name) => {
        const mtime = (await stat(join(root, name)).catch(() => null))?.mtimeMs ?? 0;
        if (seen.get(name)?.mtime === mtime) {
          return;
        }
        reads++;
        const text = await readFile(join(root, name), 'utf8').catch(() => '');
        seen.set(name, { mtime, facts: factsOf(name, text) });
      })
    );
    return buildIndex(new Map([...seen].map(([name, { facts }]) => [name, facts])));
  }

  return {
    snapshot: () => {
      watching ??= watch?.(root, invalidate) ?? null;
      if (!built || now() - builtAt > SAFETY_TTL_MS) {
        builtAt = now();
        built = refresh();
      }
      return built;
    },
    invalidate,
    dispose: () => {
      watching?.dispose();
      watching = null;
    },
    reads: () => reads
  };
}

export type ClassStore = ReturnType<typeof classIndex>;

export function infoOf(entry: ClassEntry): ClassInfo {
  return { ...entry, uses: entry.uses.slice(0, MAX_SITES), elements: entry.uses.length, files: new Set(entry.uses.map((u) => u.file)).size };
}

const EMPTY: Omit<ClassesView, 'at'> = { element: [], inFile: [], dynamic: false };

async function fileTextAt(root: string, file: string, line: number, col: number): Promise<string | null> {
  const text = await reader(root)(file);
  const start = text === null ? -1 : offsetOf(text, { file, line, col });
  const end = start < 0 || text![start] !== '<' ? -1 : openTagEnd(text!, start);
  return end < 0 ? null : text;
}

export async function classesAt(root: string, index: ClassIndex, at: string): Promise<ClassesView> {
  const live = liveAtOf(at);
  const tag = live && inside(root, live.file) ? await fileTextAt(root, live.file, live.line, live.col) : null;
  if (!live || !tag) {
    return { at, ...EMPTY };
  }
  const uses = classUsesOf(live.file, tag);
  const own = uses.filter((u) => u.line === live.line && u.col === live.col);
  const element = own.map((u) => entryOf(index, u, live.file)).filter((e): e is ClassEntry => e !== undefined);
  const inFile = [...index.values()].filter((e) => e.uses.some((u) => u.file === live.file));
  return { at, element: [...new Set(element)].map(infoOf), inFile: inFile.map(infoOf), dynamic: own.some((u) => u.dynamic) };
}

export function classOf(index: ClassIndex, target: ClassTarget): ClassInfo | undefined {
  const entry = [...index.values()].find((e) => e.name === target.name && e.rules.some((r) => r.file === target.file));
  return entry && infoOf(entry);
}
