import { z } from 'zod';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { frameHistory, CodeHistoryAction } from '$lib/server/code-push/frames-push';
import { framesDeps } from '$lib/server/code-push/frames-runtime';
import { answer, invalid } from '$lib/server/code-push/push-http';
import type { RequestHandler } from './$types';

const SHA = z.string().regex(/^[0-9a-f]{7,64}$/);

const historyBody = z.object({ nodeId: z.string().min(1), action: z.enum(CodeHistoryAction), sha: SHA.optional(), base: z.string().min(1).max(200).optional() });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = historyBody.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return invalid();
  }
  return answer(await frameHistory(framesDeps(scope.db, scope), ask.data));
};
