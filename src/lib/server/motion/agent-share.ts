import type { Db } from '$lib/server/db/client';
import { ShareState, readCanvasShare, setCanvasShare } from '$lib/server/canvas/canvas-share';
import { Capability, MODE_REFUSAL, modeAllows } from '$lib/project-mode';
import { embedUrl } from '$lib/motion/interactive/bundle';
import { EmbedFailure, publishMotionEmbed, savedMotion, type EmbedAnswer } from './agent-embed';
import { embedPublished } from './embed';

type ShareScope = { orgId: string; nodeId: string; sign?: Parameters<typeof publishMotionEmbed>[1]['sign'] };
type Shareable = { canvasId: string };

export const frameShareUrl = (origin: string, token: string, nodeId: string) => `${origin}/s/${token}/${nodeId}`;

const failed = (failure: EmbedFailure, body: Record<string, unknown> = {}): EmbedAnswer => ({ ok: false, failure, body: { error: failure, ...body } });

export async function shareable(db: Db, scope: ShareScope): Promise<Shareable | EmbedAnswer> {
  const saved = await savedMotion(db, scope);
  if (!saved) {
    return failed(EmbedFailure.NotFound);
  }
  if (!modeAllows(saved.project.mode, Capability.Share)) {
    return failed(EmbedFailure.Refused, { refusal: MODE_REFUSAL[Capability.Share] });
  }
  return { canvasId: saved.record.canvasId };
}

async function linkOf(db: Db, scope: ShareScope, origin: string, frame: Shareable): Promise<EmbedAnswer> {
  const canvas = { orgId: scope.orgId, canvasId: frame.canvasId };
  const token = (await readCanvasShare(db, canvas)) ?? (await setCanvasShare(db, { ...canvas, state: ShareState.On }));
  if (!token) {
    return failed(EmbedFailure.Storage);
  }
  return { ok: true, body: { url: frameShareUrl(origin, token, scope.nodeId), embed_url: embedUrl(origin, scope.nodeId) } };
}

export async function frameLink(db: Db, scope: ShareScope, origin: string): Promise<EmbedAnswer> {
  const frame = await shareable(db, scope);
  if ('ok' in frame) {
    return frame;
  }
  if (!(await embedPublished(db, scope.nodeId))) {
    return failed(EmbedFailure.NotPublished);
  }
  return linkOf(db, scope, origin, frame);
}

export async function shareMotionFrame(db: Db, scope: ShareScope, origin: string): Promise<EmbedAnswer> {
  const frame = await shareable(db, scope);
  if ('ok' in frame) {
    return frame;
  }

  if (!(await embedPublished(db, scope.nodeId))) {
    const embed = await publishMotionEmbed(db, scope, origin);
    if (!embed.ok) {
      return embed;
    }
  }
  return linkOf(db, scope, origin, frame);
}
