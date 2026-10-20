import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { VIEW_OPS, ViewOp, isViewOp, runView } from '$lib/server/edit/run-view';

export const config = { maxDuration: 60, memory: 2048 };

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const DESCRIBE_OP = 'describe';

const SCHEMA_OPTIONS = { io: 'input', unrepresentable: 'any' } as const;

const body = z.object({ op: z.string().optional(), input: z.record(z.string(), z.unknown()).optional() });

const listing = () => ({ ops: Object.values(ViewOp).map((name) => ({ name, access: 'read', summary: VIEW_OPS[name].summary })) });

const detail = (name: ViewOp) => ({ op: name, access: 'read', summary: VIEW_OPS[name].summary, input_schema: z.toJSONSchema(VIEW_OPS[name].input, SCHEMA_OPTIONS) });

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
  const { op = '', input = {} } = parsed.data;

  if (op === DESCRIBE_OP) {
    const asked = typeof input.op === 'string' ? input.op : undefined;
    if (asked === undefined) {
      return json({ ...listing(), schemas: Object.values(ViewOp).map(detail) }, { status: HTTP_OK });
    }
    return isViewOp(asked) ? json(detail(asked)) : json({ error: 'unknown_op', ops: Object.values(ViewOp) }, { status: HTTP_BAD_REQUEST });
  }
  if (!isViewOp(op)) {
    return json({ error: 'unknown_op', fix: 'Call op "describe".', ...listing() }, { status: HTTP_BAD_REQUEST });
  }

  const answer = await runView(resolved.caller, op, input);
  return json(answer.body, { status: answer.status });
};
