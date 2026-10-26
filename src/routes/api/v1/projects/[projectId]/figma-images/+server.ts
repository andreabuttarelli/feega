import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { UPLOAD_MAX_BYTES } from '$lib/canvas/upload-kind';
import { importCanvasLink } from '$lib/server/canvas/upload';
import { figmaTokenStore } from '$lib/server/figma/token-store';
import { FigmaOutcome, MAX_HASHES, importFigmaImages } from '$lib/server/figma/import-images';
import { rateWindow } from '$lib/server/figma/rate-window';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const MS_PER_MINUTE = 60_000;
const REQUESTS_PER_MINUTE = 12;
const HTTP_TOO_MANY = 429;

const askSchema = z.object({ fileKey: z.string().min(1).max(100), hashes: z.array(z.string().max(80)).min(1).max(MAX_HASHES) });

const limiter = rateWindow({ limit: REQUESTS_PER_MINUTE, windowMs: MS_PER_MINUTE });

const STATUS: Record<Exclude<FigmaOutcome, FigmaOutcome.Ok>, number> = {
  [FigmaOutcome.Invalid]: 400,
  [FigmaOutcome.Rejected]: 422,
  [FigmaOutcome.Unavailable]: 502
};

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: FigmaOutcome.Invalid }, { status: STATUS[FigmaOutcome.Invalid] });
  }
  if (!limiter.allow(scope.userId)) {
    return json({ error: 'rate_limited' }, { status: HTTP_TOO_MANY });
  }
  const token = await figmaTokenStore(scope.db, scope.userId).read();
  if (!token) {
    return json({ error: 'no_token' }, { status: 409 });
  }

  const importUrl = async (url: string) => (await importCanvasLink(scope.db, { orgId: scope.orgId, projectId: scope.projectId, url, maxBytes: UPLOAD_MAX_BYTES.image })).asset.id;
  const done = await importFigmaImages({ token, fileKey: ask.data.fileKey, hashes: ask.data.hashes }, { fetchFn: fetch, importUrl });

  if (done.outcome !== FigmaOutcome.Ok) {
    return json({ error: done.outcome }, { status: STATUS[done.outcome] });
  }
  return json({ assets: done.assets });
};
