import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { importUrlInto } from '$lib/server/url-import/canvas-import';
import { PAGE_EXTENT_HEIGHT, PageExtent, URL_IMPORT_STATUS, UrlImportOutcome } from '$lib/server/url-import/import-url';
import { sectioningOf, tokeningOf } from '$lib/server/url-import/url-doc';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { findNode } from '$lib/server/repos/canvas';
import type { RequestHandler } from './$types';

const askSchema = z.object({ canvasId: z.string().min(1), url: z.string().min(1).max(2000), x: z.number().finite(), y: z.number().finite(), extent: z.nativeEnum(PageExtent).default(PageExtent.Full), sections: z.boolean().default(true), tokens: z.boolean().default(true) });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: UrlImportOutcome.Invalid }, { status: URL_IMPORT_STATUS[UrlImportOutcome.Invalid] });
  }

  const done = await importUrlInto({ ...scope, actor: { kind: 'user', id: scope.userId } }, ask.data.canvasId, { url: ask.data.url, at: { x: ask.data.x, y: ask.data.y }, maxHeight: PAGE_EXTENT_HEIGHT[ask.data.extent], shape: { sectioning: sectioningOf(ask.data.sections), tokening: tokeningOf(ask.data.tokens) } });
  if (done.outcome !== UrlImportOutcome.Ok) {
    return json({ error: done.outcome }, { status: URL_IMPORT_STATUS[done.outcome] });
  }

  const node = await findNode(scope.db, { orgId: scope.orgId, nodeId: done.frameId });
  return json({ nodes: node ? [node] : [], undo: done.undo, skipped: done.skipped, truncated: done.truncated });
};
