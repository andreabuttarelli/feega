import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { runCanvasOp } from '$lib/server/edit/runners';
import { canvasProject } from '$lib/server/repos/canvas';
import { HistoryAction } from '$lib/canvas/history/timeline';
import type { CanvasOpName } from '$lib/server/canvas/canvas-ops';

const HTTP_NOT_FOUND = 404;

type Body = { name?: string };

type Route = { op: CanvasOpName; input: (body: Body) => Record<string, unknown> };

const READS: Partial<Record<string, Route>> = {
  [HistoryAction.Preview]: { op: 'preview_at', input: () => ({}) }
};

const WRITES: Partial<Record<string, Route>> = {
  [HistoryAction.Restore]: { op: 'restore_to', input: () => ({}) },
  [HistoryAction.Name]: { op: 'name_version', input: (body) => ({ name: String(body.name ?? '') }) }
};

async function run(request: Request, url: URL, params: { canvasId: string; entryId: string; action: string }, route: Route | undefined, body: Body) {
  if (!route) {
    return json({ error: 'unknown_history_action' }, { status: HTTP_NOT_FOUND });
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const { caller } = resolved;
  const projectId = await canvasProject(caller.db, { orgId: caller.orgId, canvasId: params.canvasId });
  if (!projectId) {
    return json({ error: 'canvas_not_found' }, { status: HTTP_NOT_FOUND });
  }

  const answer = await runCanvasOp(caller, { projectId, op: route.op, input: { canvasId: params.canvasId, entryId: params.entryId, ...route.input(body) } });
  return json(answer.body, { status: answer.status });
}

export const GET: RequestHandler = ({ request, url, params }) => run(request, url, params, READS[params.action], {});

export const POST: RequestHandler = async ({ request, url, params }) => run(request, url, params, WRITES[params.action], (await request.json().catch(() => ({}))) as Body);
