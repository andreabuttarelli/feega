import type { RequestHandler } from './$types';
import { answer, badRequest, signedIn } from '$lib/server/plugins/serve';

const MAX_IDS = 50;

export const POST: RequestHandler = async ({ request }) => {
  const caller = await signedIn(request);
  if (caller instanceof Response) {
    return caller;
  }

  const body = (await request.json().catch(() => null)) as { pluginIds?: unknown } | null;
  const ids = body?.pluginIds;
  if (!Array.isArray(ids) || ids.length > MAX_IDS || ids.some((id) => typeof id !== 'string')) {
    return badRequest('invalid_plugin_ids');
  }

  await caller.service.heartbeat(caller.userId, ids as string[]);

  return answer({ ok: true });
};
