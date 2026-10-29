import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { projectScope } from '$lib/server/canvas/project-scope';
import { readComponentSource } from '$lib/server/canvas/project-components';

const NOT_FOUND = 404;

export const GET: RequestHandler = async (event) => {
  const scope = await projectScope(event, event.params.projectId);
  if (scope instanceof Response) {
    return scope;
  }

  const source = await readComponentSource(scope.db, { ...scope, frameId: event.params.frameId, compId: event.params.compId });
  return source ? json({ source }) : json({ error: 'component_not_found' }, { status: NOT_FOUND });
};
