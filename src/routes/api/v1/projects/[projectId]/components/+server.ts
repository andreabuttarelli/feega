import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { projectScope } from '$lib/server/canvas/project-scope';
import { listProjectComponents } from '$lib/server/canvas/project-components';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScope(event, event.params.projectId);
  if (scope instanceof Response) {
    return scope;
  }

  return json({ canvases: await listProjectComponents(scope.db, scope) });
};
