import { json } from '@sveltejs/kit';
import { motionScope } from '$lib/server/motion/editor-scope';
import { embedPublished, embedSlot, isRefused, removeEmbed } from '$lib/server/motion/embed';
import { embedUrl } from '$lib/motion/interactive/bundle';
import { appOrigin } from '$lib/server/app-url';
import type { RequestHandler } from './$types';

const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_BAD_GATEWAY = 502;

const failureStatus = (failed: { ok: boolean }) => (isRefused(failed) ? HTTP_FORBIDDEN : HTTP_BAD_GATEWAY);

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const scope = await motionScope(locals, params);
  const nodeId = scope.motion.record.id;
  return json({ published: await embedPublished(scope.db, nodeId), url: embedUrl(appOrigin(url), nodeId) });
};

export const POST: RequestHandler = async ({ locals, params, url }) => {
  const scope = await motionScope(locals, params);
  const nodeId = scope.motion.record.id;
  const slot = await embedSlot(scope.db, nodeId, scope.mode);
  return json(slot.ok ? { ...slot, url: embedUrl(appOrigin(url), nodeId) } : slot, { status: slot.ok ? HTTP_OK : failureStatus(slot) });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const scope = await motionScope(locals, params);
  const removed = await removeEmbed(scope.db, scope.motion.record.id);
  return json(removed, { status: removed.ok ? HTTP_OK : HTTP_BAD_GATEWAY });
};
