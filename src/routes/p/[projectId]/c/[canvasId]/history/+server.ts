import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { historyScope } from '$lib/server/canvas/history-scope';
import { readHistory } from '$lib/server/canvas/history';
import { resolveConflict, ResolveOutcome } from '$lib/server/canvas/conflicts';
import { Resolution } from '$lib/server/repos/canvas-conflicts';
import { HistoryFilter, isHistoryFilter } from '$lib/canvas/history/timeline';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

const RESOLVE_STATUS: Record<ResolveOutcome, number> = {
  [ResolveOutcome.Resolved]: HTTP_OK,
  [ResolveOutcome.NotFound]: HTTP_NOT_FOUND,
  [ResolveOutcome.NodeGone]: HTTP_NOT_FOUND,
  [ResolveOutcome.AlreadyResolved]: HTTP_CONFLICT,
  [ResolveOutcome.Refused]: HTTP_CONFLICT
};

const isResolution = (value: unknown): value is Resolution => (Object.values(Resolution) as unknown[]).includes(value);

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const scope = await historyScope(locals, params);
  const author = url.searchParams.get('author') ?? '';
  const filter = isHistoryFilter(author) ? author : HistoryFilter.All;
  return json(await readHistory(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, filter, frameId: url.searchParams.get('frame') }));
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const scope = await historyScope(locals, params);

  const body = (await request.json().catch(() => ({}))) as { conflictId?: unknown; keep?: unknown };
  if (typeof body.conflictId !== 'string' || !isResolution(body.keep)) {
    throw error(HTTP_BAD_REQUEST, 'conflictId and keep (mine or theirs) are required');
  }

  const out = await resolveConflict(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, conflictId: body.conflictId, resolution: body.keep, actor: { kind: 'user', id: scope.userId } });
  return json(out, { status: RESOLVE_STATUS[out.outcome] });
};
