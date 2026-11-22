import type { ServerLoadEvent } from '@sveltejs/kit';
import { isInternalEmail } from '$lib/server/internal-users';
import { trackingAllowed } from '$lib/analytics';

export const APP_HOST_PARAM = 'host';

export const load = async ({ url, untrack, locals: { safeGetSession } }: Pick<ServerLoadEvent, 'url' | 'untrack' | 'locals'>) => {
  const { session, user } = await safeGetSession();
  const internalViewer = isInternalEmail(user?.email);
  const analyticsOptOut = !trackingAllowed(untrack(() => url.searchParams.get(APP_HOST_PARAM) ?? url.hostname)) || internalViewer;

  return { session, analyticsOptOut, internalViewer };
};

export type RootShell = Awaited<ReturnType<typeof load>>;
