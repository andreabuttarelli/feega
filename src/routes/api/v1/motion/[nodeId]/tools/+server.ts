import { json } from '@sveltejs/kit';
import { reachableCaller } from '$lib/server/org-data/reach';
import { frameToolBody, runFrameTool } from '$lib/server/edit/runners';
import { ToolRun } from '$lib/server/motion/tool-run';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 60, memory: 2048 };

const HTTP_BAD_REQUEST = 400;

export const POST: RequestHandler = async ({ request, params, url }) => {
  const caller = await reachableCaller(request, url, { nodes: [params.nodeId ?? ''] });
  if (caller instanceof Response) {
    return caller;
  }

  const body = frameToolBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: ToolRun.Invalid, detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const answer = await runFrameTool(caller, { ...body.data, nodeId: params.nodeId ?? '' });
  return json(answer.body, { status: answer.status });
};
