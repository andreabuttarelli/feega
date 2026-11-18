import { load as settingsShell } from '$lib/server/settings/shell';
import { appShell } from '$lib/server/dashboard/app-shell';
import { bearerEvent, type Bearer } from '$lib/server/api/bearer-page';

function once<T>(run: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => (pending ??= run());
}

export function dashboardChain(bearer: Bearer, request: Request, apiUrl: URL, pagePath: string) {
  const event = bearerEvent(bearer, request, apiUrl, pagePath);
  const org = once(async () => ({ org: (await appShell(event as never)).org, project: null, brand: null }));
  const layout = once(async () => (await settingsShell({ ...event, parent: org } as never)) as Record<string, unknown>);
  const parent = async () => ({ ...(await org()), ...(await layout()) });
  return { org, layout, page: { ...event, parent } };
}
