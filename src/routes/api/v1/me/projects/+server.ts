import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ORG_PARAM, bearerOf } from '$lib/server/api/bearer-page';
import { listMemberships } from '$lib/server/repos/orgs';
import { listProjects } from '$lib/server/repos/projects';
import { ProjectMode } from '$lib/project-mode';
import type { ProjectList } from '$lib/api/project-lists';

const NOT_FOUND = 404;

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const memberships = await listMemberships(bearer.db, bearer.user.id);
  const hint = url.searchParams.get(ORG_PARAM);
  const org = (memberships.find((m) => m.org.id === hint) ?? memberships[0])?.org;
  if (!org) {
    return json({ error: 'no_organization' }, { status: NOT_FOUND });
  }

  const projects = await listProjects(bearer.db, org.id);
  const body: ProjectList = {
    org: { id: org.id, name: org.name },
    projects: projects.filter((p) => p.mode === ProjectMode.Standard).map((p) => ({ id: p.id, name: p.name, lastActiveAt: p.lastActiveAt }))
  };
  return json(body);
};
