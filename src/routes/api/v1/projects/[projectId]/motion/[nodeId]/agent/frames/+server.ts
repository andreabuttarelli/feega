import { json } from '@sveltejs/kit';
import { motionAgentScope } from '$lib/server/motion/agent-scope';
import { FrameUpload, decodeFrame } from '$lib/server/motion/frames';
import { framesPrefix, putFrames, type FrameBucket } from '$lib/server/motion/frame-store';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import type { RequestHandler } from './$types';

const HTTP_BAD_REQUEST = 400;
const HTTP_STORE_FAILED = 502;

export const POST: RequestHandler = async ({ request, params, locals }) => {
  const scope = await motionAgentScope(locals, params);
  if (scope instanceof Response) {
    return scope;
  }

  const body = FrameUpload.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return json({ error: 'invalid_frames' }, { status: HTTP_BAD_REQUEST });
  }

  const frames = body.data.frames.map((f) => ({ time: f.time, bytes: decodeFrame(f.data) }));
  if (frames.some((f) => !f.bytes)) {
    return json({ error: 'frames_must_be_small_jpegs' }, { status: HTTP_BAD_REQUEST });
  }

  const bucket = scope.db.storage.from(CANVAS_ASSET_BUCKET) as unknown as FrameBucket;
  const prefix = framesPrefix({ orgId: scope.orgId, projectId: scope.project.id, nodeId: scope.motion.record.id }, body.data.callId);
  const stored = await putFrames(bucket, prefix, frames.map((f) => ({ time: f.time, bytes: f.bytes! })));
  return stored ? json({ ok: true }) : json({ error: 'store_failed' }, { status: HTTP_STORE_FAILED });
};
