import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { findMotionNode, headOrNew, motionAssets, motionTokens } from '$lib/server/motion/editor';
import { motionRenderFarm } from '$lib/server/motion/renderer';
import { renderView } from '$lib/server/motion/render-run';
import { renderQueue } from '$lib/server/motion/render-queue';
import { listNodeRuns } from '$lib/server/repos/node-runs';
import { listProjects } from '$lib/server/repos/projects';
import { registerUploadedAsset, UploadError } from '$lib/server/canvas/upload';
import { motionEditorPath } from '$lib/canvas/motion-node';
import { uploadKindOf } from '$lib/canvas/upload-kind';
import { draftFromDoc } from '$lib/motion/composition-draft';
import { COMPOSITION_MEDIA_KINDS } from '$lib/motion/components';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const MEDIA_KINDS = new Set<string>(COMPOSITION_MEDIA_KINDS);

async function scopeOf(event: Pick<RequestEvent, 'locals' | 'url' | 'cookies' | 'params'>) {
  const scope = await toolScope(event);
  const motion = await findMotionNode(scope.db, { orgId: scope.orgId, nodeId: event.params.nodeId ?? '', place: { projectId: scope.projectId } });
  if (!motion) {
    throw error(HTTP_NOT_FOUND, 'This composition does not exist, or is not yours');
  }
  return { ...scope, motion };
}

export const load: PageServerLoad = async (event) => {
  const { db, orgId, projectId, motion } = await scopeOf(event);
  const nodeScope = { orgId, nodeId: motion.record.id };
  const canvasId = motion.record.canvasId;
  const projects = await listProjects(db, orgId);
  const brandId = projects.find((p) => p.id === projectId)?.brandId ?? null;

  const [head, tokens, assets, runs] = await Promise.all([
    headOrNew(db, nodeScope, motion.node),
    motionTokens(db, { orgId, brandId }),
    motionAssets({ db, orgId, projectId, canvasId, nodeId: motion.record.id }),
    listNodeRuns(db, nodeScope)
  ]);

  return {
    projectId,
    orgId,
    node: { id: motion.record.id, name: motion.record.displayName },
    head: { version: head.version, doc: head.doc },
    draft: draftFromDoc(head.doc),
    tokens,
    assets,
    serverRender: { configured: motionRenderFarm() !== null, latest: renderView(runs), queue: renderQueue() },
    editorUrl: motionEditorPath({ projectId, canvasId, nodeId: motion.record.id }),
    canvasHref: `/p/${projectId}/c/${canvasId}`
  };
};

export const actions: Actions = {
  upload: async (event) => {
    const { db, orgId, projectId } = await scopeOf(event);
    const form = await event.request.formData();
    const fileName = String(form.get('file_name') ?? '');
    const mimeType = String(form.get('mime_type') ?? '');
    if (!MEDIA_KINDS.has(uploadKindOf(mimeType, fileName) ?? '')) {
      return fail(HTTP_BAD_REQUEST, { error: 'Only images and videos can go in a composition.' });
    }

    try {
      const { asset, kind } = await registerUploadedAsset(db, { orgId, projectId, path: String(form.get('path') ?? ''), fileName, mimeType, bytes: Number(form.get('bytes')) });
      return { assetId: asset.id, kind };
    } catch (cause) {
      if (cause instanceof UploadError) {
        return fail(HTTP_BAD_REQUEST, { error: cause.message });
      }
      throw cause;
    }
  }
};
