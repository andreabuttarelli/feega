import { json } from '@sveltejs/kit';
import { codeChanges, SYNC_STATUS, SyncOutcome } from '$lib/server/code-import/code-sync';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  const done = await codeChanges({ ...scope, actor: { kind: 'user', id: scope.userId } }, event.params.nodeId);
  return done.outcome === SyncOutcome.Ok ? json(done) : json({ error: done.outcome }, { status: SYNC_STATUS[done.outcome] });
};
