import type { RequestHandler } from './$types';
import { answer, badRequest, signedIn } from '$lib/server/plugins/serve';

export const POST: RequestHandler = async ({ request, params }) => {
  const caller = await signedIn(request);
  if (caller instanceof Response) {
    return caller;
  }

  return answer(await caller.service.install(caller.userId, params.id));
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const caller = await signedIn(request);
  if (caller instanceof Response) {
    return caller;
  }

  return answer(await caller.service.uninstall(caller.userId, params.id));
};

export const PATCH: RequestHandler = async ({ request, params }) => {
  const caller = await signedIn(request);
  if (caller instanceof Response) {
    return caller;
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== 'boolean') {
    return badRequest('invalid_enabled');
  }

  return answer(await caller.service.setEnabled(caller.userId, params.id, body.enabled));
};
