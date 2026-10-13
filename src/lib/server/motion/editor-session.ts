import { motionScope as scopeFor } from './editor-scope';
import { headOrNew, motionAssets, motionTokens } from './editor';
import { motionRenderFarm, motionRenderStorage } from './renderer';
import { batchView, renderView } from './render-run';
import { serverRenderOpen } from '$lib/motion/server-render';
import { renderQueue } from './render-queue';
import { listNodeRuns } from '$lib/server/repos/node-runs';
import { templateLibrary } from './templates';
import type { Db } from '$lib/server/db/client';
import { loadAttachments } from '$lib/server/chat-attachments/register';
import { briefAttachmentIds } from '$lib/motion/video-brief';
import { storyboardPath } from '$lib/canvas/motion-node';
import { editorGallery } from '$lib/server/gallery/editor';

type EditorParams = { projectId: string; canvasId: string; nodeId: string };

export type MotionEditorData = Awaited<ReturnType<typeof loadEditorSession>>;

export const libraryOf = (scope: { db: Db; orgId: string; userId: string }) => templateLibrary(scope.db, { orgId: scope.orgId, actor: { kind: 'user', id: scope.userId } });

export async function loadEditorSession(locals: App.Locals, params: EditorParams, url: URL) {
  const scope = await scopeFor(locals, params);
  const briefIds = briefAttachmentIds(url);
  const nodeScope = { orgId: scope.orgId, nodeId: scope.motion.record.id };
  const farm = motionRenderFarm();
  const [head, tokens, assets, runs, uploadLimit, templates, gallery, briefAttachments] = await Promise.all([
    headOrNew(scope.db, nodeScope, scope.motion.node),
    motionTokens(scope.db, { orgId: scope.orgId, brandId: scope.projectBrandId }),
    motionAssets({ db: scope.db, orgId: scope.orgId, projectId: params.projectId, canvasId: scope.canvas.id, nodeId: scope.motion.record.id }),
    listNodeRuns(scope.db, nodeScope),
    farm ? motionRenderStorage().limit().catch(() => null) : null,
    libraryOf(scope).list(),
    editorGallery(scope.db, nodeScope),
    briefIds.length ? loadAttachments(scope.db, { orgId: scope.orgId, projectId: params.projectId, ids: briefIds }) : []
  ]);

  return {
    projectId: params.projectId,
    canvas: { id: scope.canvas.id, name: scope.canvas.name },
    orgId: scope.orgId,
    node: { id: scope.motion.record.id, name: scope.motion.record.displayName, lastRenderAssetId: scope.motion.node.lastRenderAssetId, posterAssetId: scope.motion.node.posterAssetId },
    head: { version: head.version, doc: head.doc },
    tokens,
    assets,
    serverRender: { configured: farm !== null && serverRenderOpen(), latest: renderView(runs), queue: renderQueue(), uploadLimit },
    batch: batchView(runs),
    templates,
    gallery,
    briefAttachments,
    storyboardHref: storyboardPath(params.projectId, scope.motion.record.data)
  };
}
