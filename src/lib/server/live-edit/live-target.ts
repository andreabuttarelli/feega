import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { git } from '$lib/server/code-push/git-cli';
import { patchOf, type FileChange } from '$lib/server/code-import/write-back';
import { LIVE_BRANCH, liveCheckoutOf } from './live-checkout';

export enum LiveTarget {
  Folder = 'folder',
  Branch = 'branch'
}

export const LIVE_TARGET_ENV = 'FEEGA_LIVE_TARGET';

export type Saved = { id: string; files: string[]; patch: string };

export type Undo = { ok: true; id: string; files: string[]; patch: string } | { ok: false; reason: string };

export type Changed = { branch: string | null; files: string[]; patch: string };

type Target = {
  root: (folder: string) => string;
  save: (root: string, changes: FileChange[], message: string) => Promise<Saved>;
  undo: (root: string, id: string) => Promise<Undo>;
  changed: (root: string) => Promise<Changed>;
  contentOf: (root: string, path: string) => Promise<string>;
};

const OWN_COMMITS = '^(Live edit |Revert "Live edit )';
const CHANGED_SINCE = 'the file changed after this edit, so it was left as it is';
const LATER_EDIT = 'a later edit touched the same lines';

const read = (root: string, path: string) => readFile(join(root, path), 'utf8').catch(() => '');

const writeAll = (root: string, changes: FileChange[], pick: (c: FileChange) => string) => Promise.all(changes.map((c) => writeFile(join(root, c.path), pick(c))));

type Snapshot = { id: string; changes: FileChange[]; undone: boolean };

const snapshots = new Map<string, Snapshot[]>();

const takenIn = (root: string) => snapshots.get(root) ?? [];

const folder: Target = {
  root: (dir) => dir,

  async save(root, changes) {
    await writeAll(root, changes, (c) => c.after);
    const id = randomUUID();
    snapshots.set(root, [...takenIn(root), { id, changes, undone: false }]);
    return { id, files: changes.map((c) => c.path), patch: patchOf(changes) };
  },

  async undo(root, id) {
    const shot = takenIn(root).find((s) => s.id === id && !s.undone);
    if (!shot) {
      return { ok: false, reason: 'nothing to undo' };
    }
    const now = await Promise.all(shot.changes.map((c) => read(root, c.path)));
    if (shot.changes.some((c, i) => now[i] !== c.after)) {
      return { ok: false, reason: CHANGED_SINCE };
    }
    await writeAll(root, shot.changes, (c) => c.before);
    shot.undone = true;
    const back = shot.changes.map((c) => ({ path: c.path, before: c.after, after: c.before }));
    return { ok: true, id: randomUUID(), files: back.map((c) => c.path), patch: patchOf(back) };
  },

  async changed(root) {
    const firsts = new Map<string, string>();
    for (const shot of takenIn(root).filter((s) => !s.undone)) {
      shot.changes.forEach((c) => firsts.has(c.path) || firsts.set(c.path, c.before));
    }
    const changes = await Promise.all([...firsts].map(async ([path, before]) => ({ path, before, after: await read(root, path) })));
    const real = changes.filter((c) => c.before !== c.after);
    return { branch: null, files: real.map((c) => c.path), patch: patchOf(real) };
  },

  contentOf: read
};

async function committed(root: string, files: string[], message: string): Promise<string> {
  await git(root, ['add', '--', ...files]);
  const done = await git(root, ['commit', '-q', '--no-verify', '-m', message, '--', ...files]);
  if (done.code) {
    throw new Error(done.err.trim() || 'commit failed');
  }
  return (await git(root, ['rev-parse', 'HEAD'])).out.trim();
}

const branch: Target = {
  root: (dir) => liveCheckoutOf(dir),

  async save(root, changes, message) {
    await writeAll(root, changes, (c) => c.after);
    const files = changes.map((c) => c.path);
    return { id: await committed(root, files, message), files, patch: patchOf(changes) };
  },

  async undo(root, id) {
    const done = await git(root, ['revert', '--no-edit', id]);
    if (done.code) {
      await git(root, ['revert', '--abort']);
      return { ok: false, reason: LATER_EDIT };
    }
    const head = (await git(root, ['rev-parse', 'HEAD'])).out.trim();
    const files = (await git(root, ['diff', '--name-only', `${head}~1`, head])).out.split('\n').filter(Boolean);
    return { ok: true, id: head, files, patch: (await git(root, ['diff', `${head}~1`, head])).out };
  },

  async changed(root) {
    const base = (await git(root, ['log', '--format=%H', '-E', `--grep=${OWN_COMMITS}`, '--invert-grep', '-n', '1', LIVE_BRANCH])).out.trim();
    const files = (await git(root, ['diff', '--name-only', base, LIVE_BRANCH])).out.split('\n').filter(Boolean);
    return { branch: LIVE_BRANCH, files, patch: (await git(root, ['diff', base, LIVE_BRANCH])).out };
  },

  async contentOf(root, path) {
    const top = (await git(root, ['rev-parse', '--show-toplevel'])).out.trim();
    return (await git(top, ['show', `${LIVE_BRANCH}:${path}`])).out;
  }
};

const TARGETS: Record<LiveTarget, Target> = { [LiveTarget.Folder]: folder, [LiveTarget.Branch]: branch };

export const liveTarget = (): Target => TARGETS[(process.env[LIVE_TARGET_ENV] as LiveTarget) ?? LiveTarget.Folder] ?? folder;

export const liveRootOf = (dir: string) => liveTarget().root(dir);
