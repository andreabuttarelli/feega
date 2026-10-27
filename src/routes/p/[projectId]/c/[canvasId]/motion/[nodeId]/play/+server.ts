import { json } from '@sveltejs/kit';
import { motionScope } from '$lib/server/motion/editor-scope';
import { embedStatus } from '$lib/server/motion/agent-embed';
import { sharePlay } from '$lib/server/motion/agent-play';
import { appOrigin } from '$lib/server/app-url';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, url }) => {
  const scope = await motionScope(locals, params);
  const result = await sharePlay(scope.db, { orgId: scope.orgId, nodeId: scope.motion.record.id }, appOrigin(url));
  return json(result.body, { status: embedStatus(result) });
};
