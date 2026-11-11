import { json } from '@sveltejs/kit';
import { codePublish, SYNC_STATUS, SyncOutcome } from '$lib/server/code-import/code-sync';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  const done = await codePublish({ ...scope, actor: { kind: 'user', id: scope.userId } }, event.params.nodeId);
  return done.outcome === SyncOutcome.Ok ? json(done) : json({ error: done.outcome }, { status: SYNC_STATUS[done.outcome] });
};
