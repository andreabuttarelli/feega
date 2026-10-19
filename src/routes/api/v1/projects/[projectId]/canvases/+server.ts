import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bearerOf } from '$lib/server/api/bearer-page';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { listCanvases } from '$lib/server/repos/canvas';
import { canvasPath } from '$lib/server/tenancy/entry';
import type { CanvasList } from '$lib/api/project-lists';

const NOT_FOUND = 404;

export const GET: RequestHandler = async ({ request, params }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const { db, user } = bearer;
  const found = await findReachableProject(db, { projectId: params.projectId, memberships: await listMemberships(db, user.id), userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: NOT_FOUND });
  }

  const canvases = await listCanvases(db, { orgId: found.orgId, projectId: found.project.id });
  const body: CanvasList = {
    project: { id: found.project.id, name: found.project.name },
    canvases: canvases.map((c) => ({ id: c.id, name: c.name, path: canvasPath(found.project.id, c.id) }))
  };
  return json(body);
};
