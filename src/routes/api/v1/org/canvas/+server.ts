import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { resolveOrgCaller, type OrgCaller } from '$lib/server/org-data/auth';
import { gateOrgAiAction } from '$lib/server/cli-auth';
import { findProjectById } from '$lib/server/repos/projects';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { Access, CANVAS_OPS, canvasCtx, isCanvasOp } from '$lib/server/canvas/canvas-ops';
import { CANVAS_OP_SUMMARIES } from '$lib/server/canvas/canvas-op-summaries';
import { describeOps } from '$lib/server/ops-description';

type Gate = (caller: OrgCaller) => Promise<Response | undefined>;

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const DESCRIBE_OP = 'describe';

const describeInput = z.object({ op: z.string().optional() }).strict();

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
  if (name === DESCRIBE_OP) {
    const asked = describeInput.safeParse(body.input ?? {});
    if (!asked.success) {
      return json({ error: 'invalid_input', issues: asked.error.issues }, { status: HTTP_BAD_REQUEST });
    }
    const described = describeOps(CANVAS_OPS, CANVAS_OP_SUMMARIES, asked.data.op);
    return json(described, { status: 'error' in described ? HTTP_BAD_REQUEST : HTTP_OK });
  }
  if (!isCanvasOp(name)) {
    return json(describeOps(CANVAS_OPS, CANVAS_OP_SUMMARIES, name), { status: HTTP_BAD_REQUEST });
  }
  const op = CANVAS_OPS[name];

  const input = op.input.safeParse(body.input ?? {});
  if (!input.success) {
    return json({ error: 'invalid_input', issues: input.error.issues }, { status: 400 });
  }

  const project = await findProjectById(caller.db, { orgId: caller.orgId, projectId: body.project_id ?? '' });
  if (!project || !(await canvasReachable(caller.db, { orgId: caller.orgId, mode: project.mode }, caller.userId))) {
    return json({ error: 'project_not_found' }, { status: 404 });
  }

  const denied = await GATE_OF[op.access](caller);
  if (denied) {
    return denied;
  }

  const ctx = canvasCtx({ db: caller.db, orgId: caller.orgId, projectId: project.id, userId: caller.userId, brandId: project.brandId });
  return json(await op.run(ctx, input.data as never));
};
