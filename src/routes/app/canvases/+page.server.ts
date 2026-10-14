import type { PageServerLoad } from './$types';
import { signedInDb } from '$lib/server/dashboard/app-shell';
import { DASHBOARD_DEPS, dashboardFor } from '$lib/server/dashboard/dashboard';

export const load: PageServerLoad = async (event) => {
  const { db } = await signedInDb(event);
  const { org } = await event.parent();
  const { canvases } = await dashboardFor(db, DASHBOARD_DEPS, org.id);
  return { canvases };
};
