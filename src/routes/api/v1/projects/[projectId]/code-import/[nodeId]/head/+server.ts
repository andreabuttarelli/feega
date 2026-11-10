import { json } from '@sveltejs/kit';
import { codeHead, SYNC_STATUS, SyncOutcome } from '$lib/server/code-import/code-sync';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  const head = await codeHead({ ...scope, actor: { kind: 'user', id: scope.userId } }, event.params.nodeId);
  return head ? json(head) : json({ error: SyncOutcome.NotFromCode }, { status: SYNC_STATUS[SyncOutcome.NotFromCode] });
};
