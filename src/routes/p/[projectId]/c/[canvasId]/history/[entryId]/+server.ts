import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { historyScope, type HistoryScope } from '$lib/server/canvas/history-scope';
import { HistoryOutcome, actAt, previewAt } from '$lib/server/canvas/history-actions';
import { HistoryAction } from '$lib/canvas/history/timeline';
import { Side } from '$lib/motion/branch-merge';
import { RejectOutcome, type Keep } from '$lib/canvas/reject-plan';
import { RevertRefusal, revertChange } from '$lib/server/canvas/revert';

const OUTCOME_STATUS: Record<string, number> = {
  [HistoryOutcome.Done]: 200,
  [HistoryOutcome.Missing]: 404,
  [HistoryOutcome.Unsupported]: 422,
  [HistoryOutcome.Conflict]: 409,
  [RejectOutcome.Rejected]: 200,
  [RejectOutcome.Confirm]: 409,
  [RejectOutcome.NotFound]: 404,
  [RejectOutcome.Stale]: 409,
  [RevertRefusal.NotRevertable]: 422
};

type Body = { action?: string; name?: string; keep?: string; choices?: { path: string; keep: Keep; eventId?: number }[]; confirm?: boolean };

const at = (scope: HistoryScope, entryId: string) => ({ orgId: scope.orgId, canvasId: scope.canvasId, entryId, actor: { kind: 'user' as const, id: scope.userId } });

const isAction = (value: unknown): value is HistoryAction => (Object.values(HistoryAction) as unknown[]).includes(value);

const sideOf = (value: unknown) => (Object.values(Side) as unknown[]).includes(value) ? (value as Side) : undefined;

const OWN_WRITES: Partial<Record<HistoryAction, (scope: HistoryScope, entryId: string, body: Body) => Promise<{ outcome: string }>>> = {
  [HistoryAction.Revert]: (scope, entryId, body) => revertChange(scope.db, { ...at(scope, entryId), choices: body.choices, confirm: body.confirm === true })
};

async function act(scope: HistoryScope, entryId: string, body: Body): Promise<{ outcome: string }> {
  const own = OWN_WRITES[body.action as HistoryAction];
  if (own) {
    return own(scope, entryId, body);
  }
  return isAction(body.action) ? actAt(scope.db, { ...at(scope, entryId), action: body.action, name: body.name, keep: sideOf(body.keep) }) : { outcome: HistoryOutcome.Unsupported };
}

export const GET: RequestHandler = async ({ locals, params }) => {
  const scope = await historyScope(locals, params);
  const out = await previewAt(scope.db, at(scope, params.entryId));
  return json(out, { status: OUTCOME_STATUS[out.outcome] });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const scope = await historyScope(locals, params);
  const body = (await request.json().catch(() => ({}))) as Body;
  const out = await act(scope, params.entryId, body);
  return json(out, { status: OUTCOME_STATUS[out.outcome] });
};
