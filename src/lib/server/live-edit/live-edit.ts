import { readFile, writeFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import { git } from '$lib/server/code-push/git-cli';
import { patchOf } from '$lib/server/code-import/write-back';
import type { GitHost } from '$lib/server/code-push/git-host';
import { pushFiles, type PushRefused, type Pushed } from '$lib/server/code-push/push';
import type { PushLock } from '$lib/server/code-push/push-lock';
import { LIVE_BRANCH } from './live-checkout';
import { LiveProp, type Side } from '$lib/canvas/live-fields';
import { livePatch, type LiveAt } from './live-patch';
import { liveTheme, tokenFor } from './live-tokens';

export type LiveEditAsk = { at: string; prop: LiveProp; value?: string; token?: string; side?: Side; was?: string; rem?: number };

export type LiveEdited = { ok: true; sha: string; files: string[]; token: string | null; patch: string };

export type LiveRefused = { ok: false; reason: string };

export type LiveChanges = { branch: string; files: string[]; patch: string };

const AT = /^(.+):(\d+):(\d+)$/;
const PUSH_NAME = 'live-edits';
const PUSH_TITLE = 'Live edits from Feega';
const PUSH_BODY = 'Text and style edits made on live frames in Feega.';
const OWN_COMMITS = '^(Live edit |Revert "Live edit )';

export function liveAtOf(raw: string): LiveAt | null {
  const m = raw.match(AT);
  return m ? { file: m[1].replace(/^\.?\//, ''), line: Number(m[2]), col: Number(m[3]) } : null;
}

const inside = (root: string, path: string) => {
  const full = normalize(join(root, path));
  return full.startsWith(normalize(root) + sep) ? full : null;
};

const reader = (root: string) => async (path: string) => {
  const full = inside(root, path);
  return full ? readFile(full, 'utf8').catch(() => null) : null;
};

async function tokenOf(root: string, ask: LiveEditAsk): Promise<string | null> {
  if (ask.prop === LiveProp.Text) {
    return null;
  }
  return ask.token ?? tokenFor(ask.prop, ask.value ?? '', await liveTheme(reader(root), ask.rem));
}

async function committed(root: string, files: string[], message: string): Promise<string> {
  await git(root, ['add', '--', ...files]);
  const done = await git(root, ['commit', '-q', '--no-verify', '-m', message, '--', ...files]);
  if (done.code) {
    throw new Error(done.err.trim() || 'commit failed');
  }
  return (await git(root, ['rev-parse', 'HEAD'])).out.trim();
}

const writing = new Map<string, Promise<unknown>>();

function inTurn<T>(root: string, write: () => Promise<T>): Promise<T> {
  const turn = (writing.get(root) ?? Promise.resolve()).then(write, write);
  writing.set(root, turn.catch(() => undefined));
  return turn;
}

export const liveEdit = (root: string, ask: LiveEditAsk) => inTurn(root, () => edited(root, ask));

export const liveUndo = (root: string, sha: string) => inTurn(root, () => undone(root, sha));

async function edited(root: string, ask: LiveEditAsk): Promise<LiveEdited | LiveRefused> {
  const at = liveAtOf(ask.at);
  if (!at || !inside(root, at.file)) {
    return { ok: false, reason: `${ask.at} is not a file:line:col inside the app` };
  }

  const token = await tokenOf(root, ask);
  const value = token ?? ask.value ?? '';
  const out = await livePatch(reader(root), at, { prop: ask.prop, value, side: ask.side, was: ask.was });
  if (!out.files.length) {
    return { ok: false, reason: out.skipped[0] ?? 'nothing changed' };
  }

  await Promise.all(out.files.map((f) => writeFile(inside(root, f.path)!, f.after)));
  const files = out.files.map((f) => f.path);
  const sha = await committed(root, files, `Live edit ${ask.prop} at ${at.file}:${at.line}`);
  return { ok: true, sha, files, token, patch: patchOf(out.files) };
}

async function undone(root: string, sha: string): Promise<LiveEdited | LiveRefused> {
  const done = await git(root, ['revert', '--no-edit', sha]);
  if (done.code) {
    await git(root, ['revert', '--abort']);
    return { ok: false, reason: 'a later edit touched the same lines' };
  }
  const head = (await git(root, ['rev-parse', 'HEAD'])).out.trim();
  const files = (await git(root, ['diff', '--name-only', `${head}~1`, head])).out.split('\n').filter(Boolean);
  return { ok: true, sha: head, files, token: null, patch: (await git(root, ['diff', `${head}~1`, head])).out };
}

async function baseOf(root: string): Promise<string> {
  const forked = await git(root, ['log', '--format=%H', '-E', `--grep=${OWN_COMMITS}`, '--invert-grep', '-n', '1', LIVE_BRANCH]);
  return forked.out.trim();
}

export async function liveChanges(root: string): Promise<LiveChanges> {
  const base = await baseOf(root);
  const files = (await git(root, ['diff', '--name-only', base, LIVE_BRANCH])).out.split('\n').filter(Boolean);
  const patch = (await git(root, ['diff', base, LIVE_BRANCH])).out;
  return { branch: LIVE_BRANCH, files, patch };
}

export async function livePush(root: string, host: GitHost, lock: PushLock): Promise<Pushed | PushRefused> {
  const { files } = await liveChanges(root);
  const top = (await git(root, ['rev-parse', '--show-toplevel'])).out.trim();
  const contents = await Promise.all(files.map(async (path) => ({ path, content: (await git(top, ['show', `${LIVE_BRANCH}:${path}`])).out })));
  return pushFiles(host, lock, { name: PUSH_NAME, files: contents, title: PUSH_TITLE, body: PUSH_BODY });
}
