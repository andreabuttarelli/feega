import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { importCodeInto } from '$lib/server/code-import/canvas-import';
import { CODE_IMPORT_STATUS, CodeImportOutcome } from '$lib/server/code-import/import-code';
import { askedRoutes, MAX_ROUTES } from '$lib/server/code-import/repo';
import { conditionsOf, MAX_CONDITIONS } from '$lib/server/code-import/render-conditions';
import { MAX_STORIES } from '$lib/server/code-import/storybook';
import { designSystemOf } from '$lib/server/code-import/design-system';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { findNode } from '$lib/server/repos/canvas';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

const askSchema = z
  .object({ canvasId: z.string().min(1), repo: z.string().min(1).max(300).optional(), folder: z.string().min(1).max(1000).optional(), upload: z.string().min(1).max(300).optional(), app: z.string().min(1).max(200).optional(), route: z.string().max(300).optional(), routes: z.array(z.string().max(300)).max(MAX_ROUTES).optional(), storybook: z.string().min(1).max(500).optional(), stories: z.array(z.string().max(200)).max(MAX_STORIES).optional(), conditions: z.array(z.object({ scheme: z.enum(['light', 'dark']), width: z.number().int().min(240).max(3840) })).max(MAX_CONDITIONS).optional(), designSystem: z.boolean().optional(), x: z.number().finite(), y: z.number().finite() })
  .refine((a) => [a.repo, a.storybook, a.folder, a.upload].filter(Boolean).length === 1);

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: CodeImportOutcome.Invalid }, { status: CODE_IMPORT_STATUS[CodeImportOutcome.Invalid] });
  }

  const { canvasId, repo, folder, upload, app, route, routes, storybook, stories, conditions, designSystem, x, y } = ask.data;
  const done = await importCodeInto({ ...scope, actor: { kind: 'user', id: scope.userId } }, canvasId, { repo, folder, upload, app, routes: askedRoutes(route, routes), conditions: conditions ? conditionsOf(conditions) : undefined, designSystem: designSystemOf(designSystem), storybook, stories, at: { x, y } });
  if (done.outcome !== CodeImportOutcome.Ok) {
    return json({ error: done.outcome, ...(done.error ? { detail: done.error } : {}), ...(done.apps ? { apps: done.apps } : {}) }, { status: CODE_IMPORT_STATUS[done.outcome] });
  }

  const node = await findNode(scope.db, { orgId: scope.orgId, nodeId: done.frameId });
  return json({ nodes: node ? [node] : [], undo: done.undo, skipped: done.skipped, truncated: done.truncated, pages: done.pages, components: done.components, variants: done.variants, instances: done.instances, ...(done.design ? { design: done.design } : {}), ...(done.library ? { library: done.library } : {}) });
};
