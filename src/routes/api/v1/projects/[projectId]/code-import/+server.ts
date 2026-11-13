import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { ALL_ROUTES, importRoutesInto } from '$lib/server/code-import/canvas-import';
import { CODE_IMPORT_STATUS, CodeImportOutcome } from '$lib/server/code-import/import-code';
import { askedRoutes } from '$lib/server/code-import/repo';
import { MAX_LISTED_ROUTES } from '$lib/server/code-import/routes-discover';
import { delayOf } from '$lib/server/code-import/capture-wait';
import { conditionsOf, MAX_CONDITIONS } from '$lib/server/code-import/render-conditions';
import { MAX_STORIES } from '$lib/server/code-import/storybook';
import { designSystemOf } from '$lib/server/code-import/design-system';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { findNode } from '$lib/server/repos/canvas';
import { codeAdd, Land, SYNC_STATUS, SyncOutcome, type CodeAdded } from '$lib/server/code-import/code-sync';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

const askSchema = z
  .object({ canvasId: z.string().min(1), repo: z.string().min(1).max(300).optional(), folder: z.string().min(1).max(1000).optional(), upload: z.string().min(1).max(300).optional(), app: z.string().min(1).max(200).optional(), route: z.string().max(300).optional(), routes: z.union([z.array(z.string().max(300)).max(MAX_LISTED_ROUTES), z.literal(ALL_ROUTES)]).optional(), storybook: z.string().min(1).max(500).optional(), stories: z.array(z.string().max(200)).max(MAX_STORIES).optional(), conditions: z.array(z.object({ scheme: z.enum(['light', 'dark']), width: z.number().int().min(240).max(3840) })).max(MAX_CONDITIONS).optional(), designSystem: z.boolean().optional(), captureDelayMs: z.number().int().min(0).optional(), routeDelayMs: z.record(z.string().max(300), z.number().int().min(0)).optional(), into: z.string().min(1).max(64).optional(), land: z.enum(Land).optional(), x: z.number().finite(), y: z.number().finite() })
  .refine((a) => [a.repo, a.storybook, a.folder, a.upload].filter(Boolean).length === (a.into ? 0 : 1));

type Scope = Exclude<Awaited<ReturnType<typeof projectScopeOf>>, Response>;

async function addedInto(scope: Scope, ask: z.infer<typeof askSchema> & { into: string }) {
  const routes = ask.routes === ALL_ROUTES ? null : askedRoutes(ask.route, ask.routes);
  if (!routes) {
    return json({ error: CodeImportOutcome.Invalid }, { status: CODE_IMPORT_STATUS[CodeImportOutcome.Invalid] });
  }
  const land = ask.land ?? Land.Frame;
  const done = await codeAdd({ ...scope, actor: { kind: 'user', id: scope.userId } }, ask.into, { routes, conditions: ask.conditions ? conditionsOf(ask.conditions) : undefined, land });
  if (done.outcome !== SyncOutcome.Ok) {
    const status = (SYNC_STATUS as Record<string, number>)[done.outcome] ?? (CODE_IMPORT_STATUS as Record<string, number>)[done.outcome] ?? 400;
    return json({ error: done.outcome, ...(done.error ? { detail: done.error } : {}) }, { status });
  }
  const added = done as CodeAdded;
  const nodes = land === Land.Frame ? [await findNode(scope.db, { orgId: scope.orgId, nodeId: ask.into })].filter(Boolean) : [];
  return json({ nodes, map: added.map, boards: added.boards, parent: added.parent, skipped: added.skipped, ...(added.piece ? { piece: added.piece } : {}) });
}

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: CodeImportOutcome.Invalid }, { status: CODE_IMPORT_STATUS[CodeImportOutcome.Invalid] });
  }

  if (ask.data.into) {
    return addedInto(scope, { ...ask.data, into: ask.data.into });
  }

  const { canvasId, repo, folder, upload, app, route, routes, storybook, stories, conditions, designSystem, captureDelayMs, routeDelayMs, x, y } = ask.data;
  const done = await importRoutesInto({ ...scope, actor: { kind: 'user', id: scope.userId } }, canvasId, { repo, folder, upload, app, routes: routes === ALL_ROUTES ? ALL_ROUTES : askedRoutes(route, routes), conditions: conditions ? conditionsOf(conditions) : undefined, delay: delayOf({ ms: captureDelayMs, routes: routeDelayMs }), designSystem: designSystemOf(designSystem), storybook, stories, at: { x, y } });
  if (done.outcome !== CodeImportOutcome.Ok) {
    return json({ error: done.outcome, ...(done.error ? { detail: done.error } : {}), ...(done.locked ? { locked: done.locked } : {}), ...(done.apps ? { apps: done.apps } : {}) }, { status: CODE_IMPORT_STATUS[done.outcome] });
  }

  const node = await findNode(scope.db, { orgId: scope.orgId, nodeId: done.frameId });
  return json({ nodes: node ? [node] : [], undo: done.undo, skipped: done.skipped, truncated: done.truncated, pages: done.pages, locked: done.locked, components: done.components, variants: done.variants, instances: done.instances, ...(done.design ? { design: done.design } : {}), ...(done.library ? { library: done.library } : {}), ...(done.routes ? { routes: done.routes } : {}) });
};
