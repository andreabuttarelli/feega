import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { localStore } from '$lib/server/local/local-mode';
import { devFolder } from '$lib/server/dev-server/local-dev-server';
import { CodeSourceKind } from '$lib/server/code-push/link';
import { hostOf } from '$lib/server/code-push/hosts';
import { memoryLock } from '$lib/server/code-push/push-lock';
import { livePush } from '$lib/server/live-edit/live-edit';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const CONFLICT = 409;

const lock = memoryLock();

export const POST: RequestHandler = async () => {
  const store = localStore();
  if (!store) {
    error(NOT_FOUND, 'Live edits run only in local mode');
  }
  const root = devFolder(store);
  const host = await hostOf({ connected: async () => null, env: { GITHUB_PUSH_TOKEN: env.GITHUB_PUSH_TOKEN, GITHUB_API_URL: env.GITHUB_API_URL }, folder: (dir) => dir })(CodeSourceKind.Folder, root);
  const out = host ? await livePush(root, host, lock) : null;
  if (!out?.ok) {
    error(CONFLICT, out ? String(out.refusal) : 'no git repository');
  }
  return json(out);
};
