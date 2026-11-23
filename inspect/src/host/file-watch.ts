import { watch as nodeWatch, statSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { scanProject } from './project-scan';

export type Watch = (root: string, changed: () => void) => { dispose: () => void };

const SOURCE = /\.(tsx|jsx|ts|js|svelte|vue|astro|mjs|html)$|(^|\/)(tsconfig|jsconfig|package)\.json$/;
const IGNORED_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|\.nuxt|\.svelte-kit|\.output|coverage)(\/|$)/;
const POLL_MS = 2000;

export const WATCHED = (path: string): boolean => SOURCE.test(path) && !IGNORED_DIR.test(path);

export const relativeOf = (root: string, path: string): string => relative(root, path).split(sep).join('/');

export const fsWatch: Watch = (root, changed) => {
  try {
    const handle = nodeWatch(root, { recursive: true, persistent: false }, (_, name) => {
      if (name && WATCHED(String(name).split(sep).join('/'))) {
        changed();
      }
    });
    handle.on('error', () => undefined);
    return { dispose: () => handle.close() };
  } catch {
    return pollWatch(root, changed);
  }
};

async function signatureOf(root: string): Promise<string> {
  const { sources } = await scanProject(root, Infinity);
  const stamps = sources.map((path) => {
    try {
      return `${path}:${statSync(path).mtimeMs}`;
    } catch {
      return path;
    }
  });
  return stamps.sort().join('|');
}

export const pollWatch: Watch = (root, changed) => {
  let last: string | null = null;
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) {
      return;
    }
    busy = true;
    const now = await signatureOf(root).catch(() => last);
    busy = false;
    if (last !== null && now !== last) {
      changed();
    }
    last = now;
  }, POLL_MS);
  timer.unref();
  void signatureOf(root).then((first) => (last ??= first));
  return { dispose: () => clearInterval(timer) };
};
