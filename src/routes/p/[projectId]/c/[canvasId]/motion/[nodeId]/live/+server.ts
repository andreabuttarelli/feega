import { motionScope } from '$lib/server/motion/editor-scope';
import { assetUrls, headOrNew, motionAssets, motionTokens } from '$lib/server/motion/editor';
import { livePage } from '$lib/motion/interactive/bundle';
import { INERT_DOCUMENT_HEADERS } from '$lib/canvas/iframe-node';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const scope = await motionScope(locals, params);
  const nodeId = scope.motion.record.id;
  const [head, tokens, assets] = await Promise.all([
    headOrNew(scope.db, { orgId: scope.orgId, nodeId }, scope.motion.node),
    motionTokens(scope.db, { orgId: scope.orgId, brandId: scope.projectBrandId }),
    motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id })
  ]);

  const page = livePage({ doc: head.doc, tokens, assets: assetUrls(assets), title: scope.motion.record.displayName ?? 'Frame' }, url.origin);
  return new Response(page, { headers: { ...INERT_DOCUMENT_HEADERS, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
};
