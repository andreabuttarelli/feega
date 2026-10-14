import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller, type OrgCaller } from '$lib/server/org-data/auth';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { findProjectById } from '$lib/server/repos/projects';
import { Access, CANVAS_OPS, canvasCtx, isCanvasOp } from '$lib/server/canvas/canvas-ops';

type Gate = (caller: OrgCaller) => Promise<Response | undefined>;

const READ_ONLY_KEY = () => json({ error: 'api_key_read_only' }, { status: 403 });

const GATE_OF: Record<Access, Gate> = {
  [Access.Read]: async () => undefined,
  [Access.Write]: async (caller) => (caller.writeAllowed ? undefined : READ_ONLY_KEY()),
  [Access.Spend]: async (caller) => {
    if (!caller.writeAllowed) {
      return READ_ONLY_KEY();
    }
    const key = caller.apiKeyId ? { id: caller.apiKeyId, name: '', user_id: caller.userId, org_id: caller.orgId, scopes: ['write'] } : undefined;
    return gateOrgAiAction(caller.orgId, key);
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  const { caller } = resolved;

  const body = (await request.json().catch(() => ({}))) as { project_id?: string; op?: string; input?: unknown };
  const name = body.op ?? '';
  if (!isCanvasOp(name)) {
    return json({ error: 'unknown_op', ops: Object.keys(CANVAS_OPS) }, { status: 400 });
  }
  const op = CANVAS_OPS[name];

  const input = op.input.safeParse(body.input ?? {});
  if (!input.success) {
    return json({ error: 'invalid_input', issues: input.error.issues }, { status: 400 });
  }

  const project = await findProjectById(caller.db, { orgId: caller.orgId, projectId: body.project_id ?? '' });
  if (!project) {
    return json({ error: 'project_not_found' }, { status: 404 });
  }

  const denied = await GATE_OF[op.access](caller);
  if (denied) {
    return denied;
  }

  const ctx = canvasCtx({ db: caller.db, orgId: caller.orgId, projectId: project.id, userId: caller.userId, brandId: project.brandId });
  return json(await op.run(ctx, input.data as never));
};
