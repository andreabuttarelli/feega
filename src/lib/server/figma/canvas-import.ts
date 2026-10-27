import type { Db } from '$lib/server/db/client';
import { importCanvasLink } from '$lib/server/canvas/upload';
import { UPLOAD_MAX_BYTES } from '$lib/canvas/upload-kind';
import { frameStore } from '$lib/server/motion/move-element';
import type { Actor } from '$lib/server/repos/actor';
import { figmaUrl } from './file-url';
import { listFigmaFrames, type FrameListing } from './import-file';
import { importFigmaFrames, type FigmaImported } from './import-frames';
import { FigmaOutcome } from './import-images';
import { rateWindow } from './rate-window';
import { figmaTokenStore } from './token-store';

const MS_PER_MINUTE = 60_000;
const REQUESTS_PER_MINUTE = 12;

const limiter = rateWindow({ limit: REQUESTS_PER_MINUTE, windowMs: MS_PER_MINUTE });

export type FigmaScope = { db: Db; orgId: string; userId: string; projectId: string; actor: Actor };

export type FigmaFrames = { outcome: FigmaOutcome.Ok; frames: FrameListing[]; selected: string | null } | { outcome: Exclude<FigmaOutcome, FigmaOutcome.Ok> };

export async function figmaFramesOf(scope: FigmaScope, url: string): Promise<FigmaFrames> {
  const link = figmaUrl(url);
  if (!link) {
    return { outcome: FigmaOutcome.BadLink };
  }
  if (!limiter.allow(scope.userId)) {
    return { outcome: FigmaOutcome.RateLimited };
  }

  const token = await figmaTokenStore(scope.db, scope.userId).read();
  if (!token) {
    return { outcome: FigmaOutcome.NoToken };
  }

  const listed = await listFigmaFrames({ token, fileKey: link.fileKey }, fetch);
  return listed.outcome === FigmaOutcome.Ok ? { ...listed, selected: link.nodeId } : listed;
}

export async function importFigmaInto(scope: FigmaScope, canvasId: string, ask: { url: string; nodeIds: string[] | null; at: { x: number; y: number } }): Promise<FigmaImported> {
  if (!limiter.allow(scope.userId)) {
    return { outcome: FigmaOutcome.RateLimited };
  }

  const importUrl = async (url: string) => (await importCanvasLink(scope.db, { orgId: scope.orgId, projectId: scope.projectId, url, maxBytes: UPLOAD_MAX_BYTES.image })).asset.id;

  return importFigmaFrames({
    ...ask,
    store: frameStore(scope.db, { orgId: scope.orgId, actor: scope.actor, projectId: scope.projectId }),
    place: { projectId: scope.projectId, canvasId },
    token: await figmaTokenStore(scope.db, scope.userId).read(),
    fetchFn: fetch,
    importUrl,
    newId: () => crypto.randomUUID().slice(0, 8)
  });
}
