import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { historyScope, type HistoryScope } from '$lib/server/canvas/history-scope';
import { HistoryOutcome, nameAt, previewAt, restoreTo, type Acted } from '$lib/server/canvas/history-actions';
import { HistoryAction } from '$lib/canvas/history/timeline';

const OUTCOME_STATUS: Record<HistoryOutcome, number> = {
  [HistoryOutcome.Done]: 200,
  [HistoryOutcome.Missing]: 404,
  [HistoryOutcome.Unsupported]: 422,
  [HistoryOutcome.Conflict]: 409
};

type Body = { action?: string; name?: string };

const at = (scope: HistoryScope, entryId: string) => ({ orgId: scope.orgId, canvasId: scope.canvasId, entryId, actor: { kind: 'user' as const, id: scope.userId } });

const WRITES: Partial<Record<HistoryAction, (scope: HistoryScope, entryId: string, body: Body) => Promise<Acted>>> = {
  [HistoryAction.Restore]: (scope, entryId) => restoreTo(scope.db, at(scope, entryId)),
  [HistoryAction.Name]: (scope, entryId, body) => nameAt(scope.db, { ...at(scope, entryId), name: String(body.name ?? '') })
};

export const GET: RequestHandler = async ({ locals, params }) => {
  const scope = await historyScope(locals, params);
  const out = await previewAt(scope.db, at(scope, params.entryId));
  return json(out, { status: OUTCOME_STATUS[out.outcome] });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const scope = await historyScope(locals, params);
  const body = (await request.json().catch(() => ({}))) as Body;
  const write = WRITES[body.action as HistoryAction];
  const out = write ? await write(scope, params.entryId, body) : { outcome: HistoryOutcome.Unsupported };
  return json(out, { status: OUTCOME_STATUS[out.outcome] });
};
