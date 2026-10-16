import type { ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { signedInDb } from '$lib/server/dashboard/app-shell';
import { DASHBOARD_DEPS, dashboardFor } from '$lib/server/dashboard/dashboard';

export const load = async (event: Parameters<PageServerLoad>[0]) => {
  const { db } = await signedInDb(event);
  const { org } = await event.parent();
  const { canvases } = await dashboardFor(db, DASHBOARD_DEPS, org.id);
  return { canvases };
};

export type CanvasesData = Awaited<ReturnType<typeof load>>;
