import type { Db } from '$lib/server/db/client';
import { listNodes } from '$lib/server/repos/canvas';
import { findSharedCanvas, signSharedMedia } from './canvas-share';
import { findMotionNode, motionTokens } from '$lib/server/motion/editor';
import { motionSource, type MotionSource } from '$lib/server/motion/sources';
import type { BrandTokens } from '@feega/motion-core/motion/brand';

export type SharedFrame = { id: string; title: string };

export type SharedFrameView = { canvasName: string; frameId: string; title: string; frames: SharedFrame[] };

export type IsPublished = (nodeId: string) => Promise<boolean>;

const UNTITLED_FRAME = 'Untitled';

export async function readSharedFrame(db: Db, token: string, frameId: string, isPublished: IsPublished): Promise<SharedFrameView | null> {
  const canvas = await findSharedCanvas(db, token);
  if (!canvas) {
    return null;
  }

  const nodes = await listNodes(db, { orgId: canvas.org_id, canvasId: canvas.id });
  const motion = nodes.filter((node) => node.type === 'motion').sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const live = await Promise.all(motion.map(async (node) => ((await isPublished(node.id)) ? node : null)));
  const frames = live.filter((node) => node !== null).map((node) => ({ id: node.id, title: node.displayName ?? UNTITLED_FRAME }));

  const current = frames.find((frame) => frame.id === frameId);
  return current ? { canvasName: canvas.name, frameId, title: current.title, frames } : null;
}

export type SharedSource = MotionSource & { tokens: BrandTokens };

async function brandOf(db: Db, canvas: { org_id: string; project_id: string }): Promise<string | null> {
  const { data } = await db.from('projects').select('brand_id').eq('id', canvas.project_id).eq('org_id', canvas.org_id).maybeSingle();
  return data?.brand_id ?? null;
}

export async function readSharedSource(db: Db, token: string, nodeId: string): Promise<SharedSource | null> {
  const canvas = await findSharedCanvas(db, token);
  if (!canvas) {
    return null;
  }

  const orgId = canvas.org_id;
  const motion = await findMotionNode(db, { orgId, nodeId, place: { canvasId: canvas.id } });
  if (!motion) {
    return null;
  }

  const sign = signSharedMedia(db);
  const source = await motionSource({ db, orgId, projectId: canvas.project_id, canvasId: canvas.id, nodeId, sign: (paths) => sign({ ...paths, influencer: [] }) });
  if (!source) {
    return null;
  }
  return { ...source, tokens: await motionTokens(db, { orgId, brandId: await brandOf(db, canvas) }) };
}
