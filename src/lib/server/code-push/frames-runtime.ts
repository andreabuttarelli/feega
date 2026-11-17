import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { githubFor } from '$lib/server/code-import/github-runtime';
import { codeEdits } from '$lib/server/code-import/code-sync';
import { folderOf } from '$lib/server/code-import/folder-source';
import { localModeRefusal } from '$lib/server/local/local-mode';
import type { FramesDeps } from './frames-push';
import { hostOf } from './hosts';
import { dbLock, linkStore } from './link-store';

type Scope = { orgId: string; userId: string; projectId: string };

const localFolder = (raw: string) => (localModeRefusal(env) === null ? folderOf(raw) : null);

export const framesDeps = (db: Db, scope: Scope): FramesDeps => ({
  host: hostOf({ connected: () => githubFor(db, scope).call(), env: { GITHUB_PUSH_TOKEN: env.GITHUB_PUSH_TOKEN, GITHUB_API_URL: env.GITHUB_API_URL }, folder: localFolder }),
  edits: codeEdits,
  links: linkStore(db, scope),
  lock: dbLock(db, scope)
});
