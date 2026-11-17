import type { Db } from '$lib/server/db/client';
import { githubFor } from '$lib/server/code-import/github-runtime';
import { codeEdits } from '$lib/server/code-import/code-sync';
import type { FramesDeps } from './frames-push';
import { dbLock, linkStore } from './link-store';

type Scope = { orgId: string; userId: string; projectId: string };

export const framesDeps = (db: Db, scope: Scope): FramesDeps => ({ call: () => githubFor(db, scope).call(), edits: codeEdits, links: linkStore(db, scope), lock: dbLock(db, scope) });
