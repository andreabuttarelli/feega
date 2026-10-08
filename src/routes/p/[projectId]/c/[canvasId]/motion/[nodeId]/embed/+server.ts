import { json } from '@sveltejs/kit';
import { motionScope } from '$lib/server/motion/editor-scope';
import { embedPublished, embedSlot, removeEmbed } from '$lib/server/motion/embed';
import { embedUrl } from '$lib/motion/interactive/bundle';
import { appOrigin } from '$lib/server/app-url';
import type { RequestHandler } from './$types';

const HTTP_OK = 200;
const HTTP_BAD_GATEWAY = 502;

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const scope = await motionScope(locals, params);
  const nodeId = scope.motion.record.id;
  return json({ published: await embedPublished(scope.db, nodeId), url: embedUrl(appOrigin(url), nodeId) });
};

export const POST: RequestHandler = async ({ locals, params, url }) => {
  const scope = await motionScope(locals, params);
  const nodeId = scope.motion.record.id;
  const slot = await embedSlot(scope.db, nodeId);
  return json(slot.ok ? { ...slot, url: embedUrl(appOrigin(url), nodeId) } : slot, { status: slot.ok ? HTTP_OK : HTTP_BAD_GATEWAY });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const scope = await motionScope(locals, params);
  const removed = await removeEmbed(scope.db, scope.motion.record.id);
  return json(removed, { status: removed.ok ? HTTP_OK : HTTP_BAD_GATEWAY });
};
