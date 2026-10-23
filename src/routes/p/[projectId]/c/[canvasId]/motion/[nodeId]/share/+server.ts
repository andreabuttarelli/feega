import { json } from '@sveltejs/kit';
import { motionScope } from '$lib/server/motion/editor-scope';
import { embedStatus } from '$lib/server/motion/agent-embed';
import { frameLink } from '$lib/server/motion/agent-share';
import { appOrigin } from '$lib/server/app-url';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, url }) => {
  const scope = await motionScope(locals, params);
  const result = await frameLink(scope.db, { orgId: scope.orgId, nodeId: scope.motion.record.id }, appOrigin(url));
  return json(result.body, { status: embedStatus(result) });
};
