import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { importCodeInto } from '$lib/server/code-import/canvas-import';
import { CODE_IMPORT_STATUS, CodeImportOutcome } from '$lib/server/code-import/import-code';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import { findNode } from '$lib/server/repos/canvas';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };

const askSchema = z.object({ canvasId: z.string().min(1), repo: z.string().min(1).max(300), route: z.string().max(300).optional(), x: z.number().finite(), y: z.number().finite() });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: CodeImportOutcome.Invalid }, { status: CODE_IMPORT_STATUS[CodeImportOutcome.Invalid] });
  }

  const { canvasId, repo, route, x, y } = ask.data;
  const done = await importCodeInto({ ...scope, actor: { kind: 'user', id: scope.userId } }, canvasId, { repo, route, at: { x, y } });
  if (done.outcome !== CodeImportOutcome.Ok) {
    return json({ error: done.outcome, ...(done.error ? { detail: done.error } : {}) }, { status: CODE_IMPORT_STATUS[done.outcome] });
  }

  const node = await findNode(scope.db, { orgId: scope.orgId, nodeId: done.frameId });
  return json({ nodes: node ? [node] : [], undo: done.undo, skipped: done.skipped, truncated: done.truncated, components: done.components, variants: done.variants, instances: done.instances });
};
