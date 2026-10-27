import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { importFigmaInto } from '$lib/server/figma/canvas-import';
import { MAX_FRAMES } from '$lib/server/figma/import-file';
import { FIGMA_STATUS, FigmaOutcome } from '$lib/server/figma/import-images';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { findNode } from '$lib/server/repos/canvas';
import type { RequestHandler } from './$types';

const askSchema = z.object({
  canvasId: z.string().min(1),
  url: z.string().min(1).max(2000),
  frameIds: z.array(z.string()).min(1).max(MAX_FRAMES).optional(),
  x: z.number().finite(),
  y: z.number().finite()
});

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: FigmaOutcome.Invalid }, { status: FIGMA_STATUS[FigmaOutcome.Invalid] });
  }

  const at = { x: ask.data.x, y: ask.data.y };
  const done = await importFigmaInto({ ...scope, actor: { kind: 'user', id: scope.userId } }, ask.data.canvasId, { url: ask.data.url, nodeIds: ask.data.frameIds ?? null, at });
  if (done.outcome !== FigmaOutcome.Ok) {
    return json({ error: done.outcome }, { status: FIGMA_STATUS[done.outcome] });
  }

  const nodes = await Promise.all(done.frameIds.map((nodeId) => findNode(scope.db, { orgId: scope.orgId, nodeId })));
  return json({ nodes: nodes.filter((n) => n !== null), undo: done.undo, skipped: done.skipped });
};
