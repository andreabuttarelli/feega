import type { LayoutServerLoad } from './$types';
import { appShell } from '$lib/server/dashboard/app-shell';

export const load: LayoutServerLoad = async (event) => {
  event.depends('app:credits');
  return appShell(event);
};
