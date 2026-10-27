import type { Db } from '$lib/server/db/client';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { BrandTokens } from '@feega/motion-core/motion/brand';
import { FrameKind, motionOf } from '$lib/canvas/motion-node';
import { listNodes } from '$lib/server/repos/canvas';
import { findAssets } from '$lib/server/repos/assets';
import { findProjectById } from '$lib/server/repos/projects';
import { readHead } from '$lib/server/repos/motion-revisions';
import { startFrame } from '$lib/motion/prototype/flows';
import { assetUrls, motionTokens, namedAssets } from '$lib/server/motion/editor';
import { findSharedCanvas, signSharedMedia } from './canvas-share';
import type { IsPublished } from './frame-share';

export type SharedPrototypeFrame = { id: string; name: string; doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string> };

export type SharedPrototype = { canvasName: string; start: string; frames: SharedPrototypeFrame[] };

export type CanvasRef = { orgId: string; projectId: string; canvasId: string };

export type PrototypePorts = {
  db: Db;
  isPublished: IsPublished;
  doc: (nodeId: string, orgId: string) => Promise<MotionDoc | null>;
  look: (canvas: CanvasRef, docs: MotionDoc[]) => Promise<{ tokens: BrandTokens; assets: Record<string, string> }>;
};

const UNTITLED_FRAME = 'Untitled';

export async function readSharedPrototype(ports: PrototypePorts, token: string, asked: string | null): Promise<SharedPrototype | null> {
  const canvas = await findSharedCanvas(ports.db, token);
  if (!canvas) {
    return null;
  }

  const nodes = await listNodes(ports.db, { orgId: canvas.org_id, canvasId: canvas.id });
  const framed = nodes
    .filter((node) => motionOf(node)?.kind === FrameKind.Frame)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const loaded = await Promise.all(
    framed.map(async (node) => ((await ports.isPublished(node.id)) ? { node, doc: await ports.doc(node.id, canvas.org_id) } : null))
  );
  const live = loaded.flatMap((entry) => (entry?.doc ? [{ node: entry.node, doc: entry.doc }] : []));
  if (!live.length) {
    return null;
  }

  const look = await ports.look({ orgId: canvas.org_id, projectId: canvas.project_id, canvasId: canvas.id }, live.map((l) => l.doc));
  const docs = new Map(live.map((l) => [l.node.id, l.doc]));
  const start = startFrame(docs, live.map((l) => l.node.id), asked);

  return {
    canvasName: canvas.name,
    start: start!,
    frames: live.map(({ node, doc }) => ({ id: node.id, name: node.displayName ?? UNTITLED_FRAME, doc, tokens: look.tokens, assets: look.assets }))
  };
}

export function sharedPrototypePorts(db: Db, isPublished: IsPublished): PrototypePorts {
  return {
    db,
    isPublished,
    doc: async (nodeId, orgId) => (await readHead(db, { orgId, nodeId }))?.doc ?? null,
    look: async (canvas, docs) => {
      const project = await findProjectById(db, { orgId: canvas.orgId, projectId: canvas.projectId });
      const tokens = await motionTokens(db, { orgId: canvas.orgId, brandId: project?.brandId ?? null });
      const wanted = [...new Set(docs.flatMap((doc) => doc.assets.map((a) => a.id)))];
      const rows = await findAssets(db, { orgId: canvas.orgId, assetIds: wanted });
      const shareable = [...rows.values()].filter((asset) => !asset.uncensored).map((asset) => asset.id);
      const sign = (paths: { generated: string[]; uploaded: string[] }) => signSharedMedia(db)({ ...paths, influencer: [] });
      const signed = await namedAssets({ db, ...canvas, sign }, shareable);
      return { tokens, assets: assetUrls(signed) };
    }
  };
}
