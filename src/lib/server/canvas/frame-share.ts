import type { Db } from '$lib/server/db/client';
import { listNodes } from '$lib/server/repos/canvas';
import { findSharedCanvas } from './canvas-share';

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
