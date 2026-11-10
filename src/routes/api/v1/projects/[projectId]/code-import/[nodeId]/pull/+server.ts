import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { codePull, SYNC_STATUS, SyncOutcome } from '$lib/server/code-import/code-sync';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

const askSchema = z.object({ branch: z.string().min(1).max(200).regex(/^[A-Za-z0-9._/-]+$/).optional() });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  const ask = askSchema.safeParse(await event.request.json().catch(() => ({})));
  if (!ask.success) {
    return json({ error: 'invalid' }, { status: 400 });
  }
  const done = await codePull({ ...scope, actor: { kind: 'user', id: scope.userId } }, event.params.nodeId, ask.data.branch);
  if (done.outcome === SyncOutcome.Ok || done.outcome === SyncOutcome.UpToDate) {
    return json(done);
  }
  return json({ error: done.outcome, ...('error' in done && done.error ? { detail: done.error } : {}) }, { status: SYNC_STATUS[done.outcome] });
};
