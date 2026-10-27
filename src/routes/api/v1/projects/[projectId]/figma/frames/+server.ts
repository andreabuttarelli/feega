import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { figmaFramesOf } from '$lib/server/figma/canvas-import';
import { FIGMA_STATUS, FigmaOutcome } from '$lib/server/figma/import-images';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const askSchema = z.object({ url: z.string().min(1).max(2000) });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: FigmaOutcome.Invalid }, { status: FIGMA_STATUS[FigmaOutcome.Invalid] });
  }

  const listed = await figmaFramesOf({ ...scope, actor: { kind: 'user', id: scope.userId } }, ask.data.url);
  if (listed.outcome !== FigmaOutcome.Ok) {
    return json({ error: listed.outcome }, { status: FIGMA_STATUS[listed.outcome] });
  }
  return json({ frames: listed.frames, selected: listed.selected });
};
