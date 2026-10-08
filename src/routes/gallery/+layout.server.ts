import type { LayoutServerLoad } from './$types';
import { appShell, type AppShell } from '$lib/server/dashboard/app-shell';

export const load: LayoutServerLoad = async (event) => {
  const { user } = await event.locals.safeGetSession();
  const shell: AppShell | null = user ? await appShell(event).catch(() => null) : null;
  return { shell };
};
