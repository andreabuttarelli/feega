import type { ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { signedInDb } from '$lib/server/dashboard/app-shell';
import { DASHBOARD_DEPS, recentCanvasesFor } from '$lib/server/dashboard/dashboard';

export const load = async (event: Parameters<PageServerLoad>[0]) => {
  const { db } = await signedInDb(event);
  const { org } = await event.parent();
  return { canvases: await recentCanvasesFor(db, DASHBOARD_DEPS, org.id) };
};

export type CanvasesData = Awaited<ReturnType<typeof load>>;
