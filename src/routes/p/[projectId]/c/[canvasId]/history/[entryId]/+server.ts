import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { historyScope, type HistoryScope } from '$lib/server/canvas/history-scope';
import { HistoryOutcome, actAt, previewAt } from '$lib/server/canvas/history-actions';
import { HistoryAction } from '$lib/canvas/history/timeline';
import { Side } from '$lib/motion/branch-merge';

const OUTCOME_STATUS: Record<HistoryOutcome, number> = {
  [HistoryOutcome.Done]: 200,
  [HistoryOutcome.Missing]: 404,
  [HistoryOutcome.Unsupported]: 422,
  [HistoryOutcome.Conflict]: 409
};

type Body = { action?: string; name?: string; keep?: string };

const at = (scope: HistoryScope, entryId: string) => ({ orgId: scope.orgId, canvasId: scope.canvasId, entryId, actor: { kind: 'user' as const, id: scope.userId } });

const isAction = (value: unknown): value is HistoryAction => (Object.values(HistoryAction) as unknown[]).includes(value);

const sideOf = (value: unknown) => (Object.values(Side) as unknown[]).includes(value) ? (value as Side) : undefined;

export const GET: RequestHandler = async ({ locals, params }) => {
  const scope = await historyScope(locals, params);
  const out = await previewAt(scope.db, at(scope, params.entryId));
  return json(out, { status: OUTCOME_STATUS[out.outcome] });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const scope = await historyScope(locals, params);
  const body = (await request.json().catch(() => ({}))) as Body;
  const out = isAction(body.action) ? await actAt(scope.db, { ...at(scope, params.entryId), action: body.action, name: body.name, keep: sideOf(body.keep) }) : { outcome: HistoryOutcome.Unsupported };
  return json(out, { status: OUTCOME_STATUS[out.outcome] });
};
