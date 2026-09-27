import type { Actions, PageServerLoad } from './$types';
import { sync, disconnect } from '$lib/server/settings-actions';

export const load: PageServerLoad = async ({ parent }) => {
  const { brand } = await parent();
  return { brand };
};

export const actions: Actions = { sync, disconnect };
