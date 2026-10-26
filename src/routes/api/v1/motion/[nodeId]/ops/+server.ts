import { json } from '@sveltejs/kit';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { EDITOR_OPS, isEditorOp } from '$lib/server/frame-editor/editor-ops';
import { EDITOR_OP_SUMMARIES } from '$lib/server/frame-editor/editor-op-summaries';
import { describeOps } from '$lib/server/ops-description';
import { runEditorAction } from '$lib/server/edit/runners';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const DESCRIBE_OP = 'describe';

const describeInput = z.object({ op: z.string().optional() }).strict();

export const POST: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const body = (await request.json().catch(() => ({}))) as { op?: string; input?: unknown };
  const name = body.op ?? '';
  if (name === DESCRIBE_OP) {
    const asked = describeInput.safeParse(body.input ?? {});
    if (!asked.success) {
      return json({ error: 'invalid_input', issues: asked.error.issues }, { status: HTTP_BAD_REQUEST });
    }
    const described = describeOps(EDITOR_OPS, EDITOR_OP_SUMMARIES, asked.data.op);
    return json(described, { status: 'error' in described ? HTTP_BAD_REQUEST : HTTP_OK });
  }
  if (!isEditorOp(name)) {
    return json(describeOps(EDITOR_OPS, EDITOR_OP_SUMMARIES, name), { status: HTTP_BAD_REQUEST });
  }

  const answer = await runEditorAction(resolved.caller, { nodeId: params.nodeId ?? '', op: name, input: body.input });
  return json(answer.body, { status: answer.status });
};
