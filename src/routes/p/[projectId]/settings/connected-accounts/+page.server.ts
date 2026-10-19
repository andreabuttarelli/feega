import type { Actions, PageServerLoad } from './$types';
import { sync, disconnect } from '$lib/server/settings-actions';
import { load as projectShell } from '$lib/server/projects/project-shell';

export const load: PageServerLoad = async (event) => {
  const { brand } = await projectShell(event);
  return { brand };
};

export const actions: Actions = { sync, disconnect };
