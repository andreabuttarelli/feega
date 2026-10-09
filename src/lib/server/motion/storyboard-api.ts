import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import { findNode } from '$lib/server/repos/canvas';
import { agentActor } from '$lib/server/repos/actor';
import { motionOf } from '$lib/canvas/motion-node';
import { boardMedia, storyboardSchema } from '$lib/motion/storyboard';
import { listProjectAssets } from '$lib/server/repos/assets';
import { storyboardStore } from './storyboard';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const API_AGENT_KEY = 'mcp';

type Scope = { orgId: string; userId: string; nodeId: string };

const editSchema = z.object({ card_id: z.string().min(1), text: z.string().min(1).max(4000) });

const bad = (error: string) => json({ error }, { status: HTTP_BAD_REQUEST });

async function opened(db: Db, scope: Scope) {
  const record = await findNode(db, { orgId: scope.orgId, nodeId: scope.nodeId });
  if (!record || !motionOf(record)) {
    return null;
  }
  const store = storyboardStore(db, { orgId: scope.orgId, projectId: record.projectId, motionNodeId: record.id, title: record.displayName ?? 'Video', actor: agentActor(scope.userId, API_AGENT_KEY) });
  return { record, store };
}

const notFound = () => json({ error: 'motion_node_not_found' }, { status: HTTP_NOT_FOUND });

export async function readBoard(db: Db, scope: Scope): Promise<Record<string, unknown> | Response> {
  const motion = await opened(db, scope);
  if (!motion) {
    return notFound();
  }
  const read = await motion.store.read();
  return read ? { canvas_id: read.canvasId, cards: read.cards, media: read.media, flow: read.flow } : { storyboard: null };
}

export async function writeBoard(db: Db, scope: Scope, body: unknown): Promise<Record<string, unknown> | Response> {
  const motion = await opened(db, scope);
  if (!motion) {
    return notFound();
  }
  const board = storyboardSchema.safeParse(body);
  if (!board.success) {
    return bad(board.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const assets = await listProjectAssets(db, { orgId: scope.orgId, projectId: motion.record.projectId });
  const media = boardMedia(board.data, assets.map((a) => ({ id: a.id, kind: a.type })));
  if (!media.ok) {
    return bad(media.error);
  }
  const written = await motion.store.write(board.data, media.kinds);
  return { canvas_id: written.canvasId, nodes: written.nodes, connections: written.connections };
}

export async function editBoard(db: Db, scope: Scope, body: unknown): Promise<Record<string, unknown> | Response> {
  const motion = await opened(db, scope);
  if (!motion) {
    return notFound();
  }
  const edit = editSchema.safeParse(body);
  if (!edit.success) {
    return bad('card_id and text are required');
  }
  const out = await motion.store.edit(edit.data.card_id, edit.data.text);
  return out.ok ? out : bad(out.error);
}
