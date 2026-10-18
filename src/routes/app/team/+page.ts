import type { PageLoad } from './$types';
import { readJson } from '$lib/dashboard/api';
import type { Team } from '$lib/server/team/team';

export const load: PageLoad = async ({ parent }) => {
  const shell = await parent();
  return { orgId: shell.org.id, orgName: shell.org.name, team: await readJson<Team>(`/api/v1/orgs/${shell.org.id}/team`) };
};
