import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { importCodeInto } from '$lib/server/code-import/canvas-import';
import { CODE_IMPORT_STATUS, CodeImportOutcome } from '$lib/server/code-import/import-code';
import { askedRoutes, MAX_ROUTES } from '$lib/server/code-import/repo';
import { MAX_STORIES } from '$lib/server/code-import/storybook';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { findNode } from '$lib/server/repos/canvas';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

const askSchema = z
  .object({ canvasId: z.string().min(1), repo: z.string().min(1).max(300).optional(), route: z.string().max(300).optional(), routes: z.array(z.string().max(300)).max(MAX_ROUTES).optional(), storybook: z.string().min(1).max(500).optional(), stories: z.array(z.string().max(200)).max(MAX_STORIES).optional(), x: z.number().finite(), y: z.number().finite() })
  .refine((a) => Boolean(a.repo) !== Boolean(a.storybook));

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: CodeImportOutcome.Invalid }, { status: CODE_IMPORT_STATUS[CodeImportOutcome.Invalid] });
  }

  const { canvasId, repo, route, routes, storybook, stories, x, y } = ask.data;
  const done = await importCodeInto({ ...scope, actor: { kind: 'user', id: scope.userId } }, canvasId, { repo, routes: askedRoutes(route, routes), storybook, stories, at: { x, y } });
  if (done.outcome !== CodeImportOutcome.Ok) {
    return json({ error: done.outcome, ...(done.error ? { detail: done.error } : {}) }, { status: CODE_IMPORT_STATUS[done.outcome] });
  }

  const node = await findNode(scope.db, { orgId: scope.orgId, nodeId: done.frameId });
  return json({ nodes: node ? [node] : [], undo: done.undo, skipped: done.skipped, truncated: done.truncated, pages: done.pages, components: done.components, variants: done.variants, instances: done.instances });
};
