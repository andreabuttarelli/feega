import { forkOf } from './branch-store';
import { canvasScope, motionOrThrow, nodeLookup, type CanvasScope } from './editor-scope';
import { motionAssets, motionTokens, newHead } from './editor';
import { readHead } from '$lib/server/repos/motion-revisions';
import { serverTiming, type Phases } from '$lib/server/server-timing';
import { knownRenderLimit, motionRenderFarm } from './renderer';
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
type SessionAsk = { projectId: string; nodeId: string; briefIds: string[] };

export type MotionEditorData = Awaited<ReturnType<typeof editorSession>>;

export const libraryOf = (scope: { db: Db; orgId: string; userId: string }) => templateLibrary(scope.db, { orgId: scope.orgId, actor: { kind: 'user', id: scope.userId } });

export async function loadEditorSession(locals: App.Locals, params: EditorParams, url: URL, phases: Phases = serverTiming()) {
  const canvas = await phases.time('scope', canvasScope(locals, params));
  return editorSession(canvas, { projectId: params.projectId, nodeId: params.nodeId, briefIds: briefAttachmentIds(url) }, phases);
}

export async function editorSession(canvas: CanvasScope, params: SessionAsk, phases: Phases = serverTiming()) {
  const { db, userId, found } = canvas;
  const { briefIds } = params;
  const nodeScope = { orgId: found.orgId, nodeId: params.nodeId };
  const farm = motionRenderFarm();
  const uploadLimit = farm ? knownRenderLimit() : null;
  const [lookup, savedHead, tokens, assets, runs, templates, gallery, briefAttachments] = await Promise.all([
    phases.time('node', nodeLookup(canvas, params.nodeId)),
    phases.time('head', readHead(db, nodeScope)),
    phases.time('tokens', motionTokens(db, { orgId: found.orgId, brandId: found.projectBrandId })),
    phases.time('assets', motionAssets({ db, orgId: found.orgId, projectId: params.projectId, canvasId: found.canvas.id })),
    phases.time('runs', listNodeRuns(db, nodeScope)),
    phases.time('templates', libraryOf({ db, orgId: found.orgId, userId }).own()),
    phases.time('gallery', editorGallery(db, nodeScope)),
    briefIds.length ? phases.time('brief', loadAttachments(db, { orgId: found.orgId, projectId: params.projectId, ids: briefIds })) : []
  ]);
  const scope = motionOrThrow(canvas, lookup);
  const head = savedHead ?? newHead(scope.motion.node);

  return {
    projectId: params.projectId,
    canvas: { id: scope.canvas.id, name: scope.canvas.name },
    orgId: scope.orgId,
    node: { id: scope.motion.record.id, name: scope.motion.record.displayName, lastRenderAssetId: scope.motion.node.lastRenderAssetId, posterAssetId: scope.motion.node.posterAssetId, kind: scope.motion.node.kind, fork: forkOf(scope.motion.record) },
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
