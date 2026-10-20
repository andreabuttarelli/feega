import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { describeEdit, describeInput } from '$lib/server/edit/describe-edit';
import { editPorts } from '$lib/server/edit/edit-ports';
import { runEdit } from '$lib/server/edit/run-edit';
import { RESERVED_OPS } from '$lib/server/edit/edit-catalogue';

export const config = { maxDuration: 60, memory: 2048 };

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const DESCRIBE_OP = 'describe';
const BATCH_OP = 'batch';
const MAX_STEPS = 500;

const step = z.object({ op: z.string().min(1), target: z.string().optional(), element: z.string().optional(), input: z.record(z.string(), z.unknown()).optional(), version: z.number().int().min(0).optional() });

const body = z.object({ project_id: z.string().optional(), ops: z.array(step).min(1).max(MAX_STEPS).optional() }).extend(step.shape).partial({ op: true });

export const POST: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: 'invalid_input', issues: parsed.error.issues }, { status: HTTP_BAD_REQUEST });
  }
  const ask = parsed.data;

  if (ask.op === DESCRIBE_OP) {
    const asked = describeInput.safeParse(ask.input ?? {});
    if (!asked.success) {
      return json({ error: 'invalid_input', issues: asked.error.issues }, { status: HTTP_BAD_REQUEST });
    }
    const described = await describeEdit(asked.data);
    return json(described, { status: 'error' in described ? HTTP_BAD_REQUEST : HTTP_OK });
  }

  const steps = ask.op === BATCH_OP ? ask.ops : ask.op && !RESERVED_OPS.includes(ask.op) ? [{ op: ask.op, target: ask.target, element: ask.element, input: ask.input, version: ask.version }] : undefined;
  if (!steps) {
    return json({ error: 'invalid_input', fix: 'Pass `op` (or op "batch" with `ops`). Call op "describe" for the list.' }, { status: HTTP_BAD_REQUEST });
  }

  const answer = await runEdit(editPorts(resolved.caller), { projectId: ask.project_id, steps, batch: ask.op === BATCH_OP });
  return json(answer.body, { status: answer.status });
};
