import type { Db } from '$lib/server/db/client';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { ShareState, readCanvasShare, setCanvasShare } from '$lib/server/canvas/canvas-share';
import { FrameKind, motionOf } from '$lib/canvas/motion-node';
import { listNodes } from '$lib/server/repos/canvas';
import { readHead } from '$lib/server/repos/motion-revisions';
import { flowsOf } from '$lib/motion/prototype/flows';
import { reachableFrom } from '$lib/motion/prototype/reach';
import { EmbedFailure, publishMotionEmbed, type EmbedAnswer } from './agent-embed';
import { embedPublished } from './embed';
import { shareable } from './agent-share';

type PlayScope = { orgId: string; nodeId: string; sign?: Parameters<typeof publishMotionEmbed>[1]['sign'] };

export const playUrl = (origin: string, token: string, nodeId: string) => `${origin}/play/${token}?frame=${nodeId}`;

const failed = (failure: EmbedFailure): EmbedAnswer => ({ ok: false, failure, body: { error: failure } });

async function canvasDocs(db: Db, orgId: string, canvasId: string): Promise<{ order: string[]; docs: Map<string, MotionDoc> }> {
  const nodes = (await listNodes(db, { orgId, canvasId }))
    .filter((node) => motionOf(node)?.kind === FrameKind.Frame)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const heads = await Promise.all(nodes.map(async (node) => [node.id, (await readHead(db, { orgId, nodeId: node.id }))?.doc ?? null] as const));
  const docs = new Map(heads.flatMap(([id, doc]) => (doc ? [[id, doc] as const] : [])));
  return { order: nodes.map((n) => n.id).filter((id) => docs.has(id)), docs };
}

export async function sharePlay(db: Db, scope: PlayScope, origin: string): Promise<EmbedAnswer> {
  const frame = await shareable(db, scope);
  if ('ok' in frame) {
    return frame;
  }

  const { order, docs } = await canvasDocs(db, scope.orgId, frame.canvasId);
  const reached = reachableFrom(docs, scope.nodeId);
  if (!reached.length) {
    return failed(EmbedFailure.NotFound);
  }

  for (const nodeId of reached) {
    if (await embedPublished(db, nodeId)) {
      continue;
    }
    const published = await publishMotionEmbed(db, { ...scope, nodeId }, origin);
    if (!published.ok) {
      return published;
    }
  }

  const canvas = { orgId: scope.orgId, canvasId: frame.canvasId };
  const token = (await readCanvasShare(db, canvas)) ?? (await setCanvasShare(db, { ...canvas, state: ShareState.On }));
  if (!token) {
    return failed(EmbedFailure.Storage);
  }

  const flows = flowsOf(docs, order).map((flow) => ({ frame_id: flow.frame, name: flow.name }));
  return { ok: true, body: { url: playUrl(origin, token, scope.nodeId), frames: reached, flows } };
}
