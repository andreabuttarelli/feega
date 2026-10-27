import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { batchScopeOf, callerOf, notFound, readOnly } from '$lib/server/studio/studio-api';
import { applyAction, isBatchAction, type ActionInput } from '$lib/server/studio/studio-actions';
import { batchView } from '$lib/server/studio/batch-page';

export { config } from '$lib/server/studio/batch-page';

const ACTION_PARAM = 'action';

async function inputOf(request: Request): Promise<ActionInput> {
  const body = (await request.json().catch(() => ({}))) as { itemIds?: unknown; variations?: unknown };
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(String) : [];
  return { itemIds, variations: Number(body.variations ?? 1) };
}

export const GET: RequestHandler = async ({ request, url, params }) => {
  const caller = await callerOf(request, url);
  if (caller instanceof Response) {
    return caller;
  }

  const scope = await batchScopeOf(caller, params.batchId);
  return scope ? json(await batchView(scope)) : notFound();
};

export const POST: RequestHandler = async ({ request, url, params }) => {
  const caller = await callerOf(request, url);
  if (caller instanceof Response) {
    return caller;
  }

  const action = url.searchParams.get(ACTION_PARAM) ?? '';
  const scope = isBatchAction(action) ? await batchScopeOf(caller, params.batchId) : null;
  if (!isBatchAction(action) || !scope) {
    return notFound();
  }
  if (!caller.writeAllowed) {
    return readOnly();
  }

  const result = await applyAction(scope, action, await inputOf(request));
  return 'error' in result ? json({ error: result.error }, { status: result.status }) : json(result.data);
};
