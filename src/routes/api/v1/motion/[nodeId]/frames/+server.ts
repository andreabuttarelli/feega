import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { reachableCaller } from '$lib/server/org-data/reach';
import { FramesFailure, motionFrames } from '$lib/server/motion/agent-frames';
import { remoteFramesWhenClosed } from '$lib/server/edit/frames-source';
import { serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { MAX_FRAME_SIZE } from '$lib/server/motion/server-frames';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 60, memory: 2048 };

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY = 429;
const HTTP_UNAVAILABLE = 503;

const STATUS_OF: Record<FramesFailure, number> = {
  [FramesFailure.NotFound]: HTTP_NOT_FOUND,
  [FramesFailure.Empty]: HTTP_CONFLICT,
  [FramesFailure.BadTimes]: HTTP_BAD_REQUEST,
  [FramesFailure.Limited]: HTTP_TOO_MANY,
  [FramesFailure.Closed]: HTTP_UNAVAILABLE
};

const bodySchema = z.object({ times: z.array(z.number()), width: z.number().int().min(64).max(MAX_FRAME_SIZE).optional() });

export const POST: RequestHandler = async ({ request, params, url }) => {
  const caller = await reachableCaller(request, url, { nodes: [params.nodeId ?? ''] });
  if (caller instanceof Response) {
    return caller;
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: FramesFailure.BadTimes, detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const remote = bearer ? await remoteFramesWhenClosed({ nodeId: params.nodeId ?? '', times: body.data.times, width: body.data.width }, { bearer, ownOrigin: url.origin, org: url.searchParams.get('org') ?? undefined, open: serverFramesOpen() }) : null;
  if (remote) {
    return json(remote.body, { status: remote.status });
  }

  const { db, orgId } = caller;
  const answer = await motionFrames(db, { orgId, nodeId: params.nodeId ?? '' }, { times: body.data.times, size: body.data.width });
  if (!answer.ok) {
    return json({ error: answer.failure, detail: answer.detail }, { status: STATUS_OF[answer.failure] });
  }
  return json(answer.body);
};
