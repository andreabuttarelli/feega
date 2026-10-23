import type { Db } from '$lib/server/db/client';
import { listMemberships } from '$lib/server/repos/orgs';
import { listProjects } from '$lib/server/repos/projects';
import { chooseOrg } from '$lib/server/tenancy/context';
import { ProjectMode } from '$lib/project-mode';

export async function standardTargets(db: Db, userId: string, chosenOrg: string | null): Promise<{ id: string; name: string }[]> {
  const membership = chooseOrg(await listMemberships(db, userId), chosenOrg);
  const projects = membership ? await listProjects(db, membership.org.id) : [];
  return projects.filter((p) => p.mode === ProjectMode.Standard).map((p) => ({ id: p.id, name: p.name }));
}
