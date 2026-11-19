import { git } from '$lib/server/code-push/git-cli';
import type { GitHost } from '$lib/server/code-push/git-host';
import { pushFiles, type PushRefused, type Pushed } from '$lib/server/code-push/push';
import type { PushLock } from '$lib/server/code-push/push-lock';
import { liveTarget, type Changed } from './live-target';
import { livePatch } from './live-patch';
import { inside, liveAtOf, reader, tokenOf, type LiveEditAsk } from '@feega/live-edit/live-ask';

export { liveAtOf, type LiveEditAsk };

export type LiveEdited = { ok: true; sha: string; files: string[]; token: string | null; patch: string };

export type LiveRefused = { ok: false; reason: string };

export type LiveChanges = Changed;

const PUSH_NAME = 'live-edits';
const PUSH_TITLE = 'Live edits from Feega';
const PUSH_BODY = 'Text and style edits made on live frames in Feega.';

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
  const out = await livePatch(reader(root), at, { prop: ask.prop, family: ask.family, value, side: ask.side, was: ask.was, viewport: ask.viewport });
  if (out.skipped.length) {
    return { ok: false, reason: out.skipped[0] };
  }
  if (!out.files.length) {
    return { ok: true, sha: '', files: [], token, patch: '' };
  }

  const saved = await liveTarget().save(root, out.files, `Live edit ${ask.prop} at ${at.file}:${at.line}`);
  return { ok: true, sha: saved.id, files: saved.files, token, patch: saved.patch };
}

async function undone(root: string, sha: string): Promise<LiveEdited | LiveRefused> {
  const out = await liveTarget().undo(root, sha);
  return out.ok ? { ok: true, sha: out.id, files: out.files, token: null, patch: out.patch } : out;
}

export const liveChanges = (root: string): Promise<LiveChanges> => liveTarget().changed(root);

export async function livePush(root: string, host: GitHost, lock: PushLock): Promise<Pushed | PushRefused> {
  const { files } = await liveChanges(root);
  const contents = await Promise.all(files.map(async (path) => ({ path, content: await liveTarget().contentOf(root, path) })));
  return pushFiles(host, lock, { name: PUSH_NAME, files: contents, title: PUSH_TITLE, body: PUSH_BODY });
}
