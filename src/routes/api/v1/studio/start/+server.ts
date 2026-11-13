import { json } from '@sveltejs/kit';
import { AgentKey, launchKey } from '$lib/server/repos/actor';
import { agentEditRefusal } from '$lib/server/agent-edits/cap';
import type { RequestHandler } from './$types';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { startBatch } from '$lib/server/studio/studio-batch';
import { studioOptions } from '$lib/server/studio/studio-options';
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_UNPROCESSABLE, readOnly, studioRequest } from '$lib/server/studio/studio-api';
import { quoteIdOf, summarize } from '$lib/server/studio/studio-quote';

const HTTP_PAYMENT_REQUIRED = 402;

export const POST: RequestHandler = async ({ request, url }) => {
  const resolved = await studioRequest(request, url);
  if (resolved instanceof Response) {
    return resolved;
  }

  const { caller, scope, selection, quote, body } = resolved;
  if (!caller.writeAllowed) {
    return readOnly();
  }
  if (typeof body.quoteId !== 'string') {
    return json({ error: 'quote_required' }, { status: HTTP_BAD_REQUEST });
  }
  if (body.quoteId !== quoteIdOf(selection, summarize(quote))) {
    return json({ error: 'quote_stale' }, { status: HTTP_CONFLICT });
  }

  const denied = await gateOrgAiActionForForm(scope.orgId);
  if (denied) {
    return json(denied.data, { status: denied.status });
  }

  const full = caller.apiKeyId ? await agentEditRefusal(scope.db, scope.orgId) : null;
  if (full) {
    return full;
  }

  const outcome = await startBatch(scope.db, { ...scope, agentKey: launchKey(AgentKey.Studio, caller) }, selection, await studioOptions(scope.db, scope));
  if ('error' in outcome) {
    return json({ error: outcome.error, shortfall: outcome.shortfall ?? null }, { status: outcome.shortfall ? HTTP_PAYMENT_REQUIRED : HTTP_UNPROCESSABLE });
  }
  return json({ batchId: outcome.batchId });
};
