import type { RequestHandler } from './$types';
import { answer, signedIn } from '$lib/server/plugins/serve';

export const POST: RequestHandler = async ({ request, params }) => {
  const caller = await signedIn(request);
  if (caller instanceof Response) {
    return caller;
  }

  return answer(await caller.service.vote(caller.userId, params.id));
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const caller = await signedIn(request);
  if (caller instanceof Response) {
    return caller;
  }

  return answer(await caller.service.unvote(caller.userId, params.id));
};
