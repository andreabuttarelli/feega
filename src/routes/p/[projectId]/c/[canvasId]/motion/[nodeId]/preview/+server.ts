import { json } from '@sveltejs/kit';
import { motionScope } from '$lib/server/motion/editor-scope';
import { assetUrls, headOrNew, motionAssets, motionTokens } from '$lib/server/motion/editor';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import type { MotionPreview } from '$lib/canvas/motion-preview';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  const scope = await motionScope(locals, params);
  const nodeId = scope.motion.record.id;
  const [head, tokens, assets] = await Promise.all([
    headOrNew(scope.db, { orgId: scope.orgId, nodeId }, scope.motion.node),
    motionTokens(scope.db, { orgId: scope.orgId, brandId: scope.projectBrandId }),
    motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id, nodeId })
  ]);

  const { doc } = head;
  const preview: MotionPreview = {
    version: head.version,
    html: composeHtml({ doc, tokens, assets: assetUrls(assets) }),
    width: doc.width,
    height: doc.height,
    fps: doc.fps,
    durationInFrames: doc.durationInFrames
  };
  return json(preview);
};
