import { error } from '@sveltejs/kit';
import { load as settingsShell } from '$lib/server/settings/shell';
import { loadBrandShell } from '$lib/server/projects/brand-shell';
import type { Bearer } from '$lib/server/api/bearer-page';
import { dashboardChain, once } from '../chain';

const NOT_FOUND = 404;

export function brandChain(bearer: Bearer, request: Request, apiUrl: URL, pagePath: string, brandId: string) {
  const { org, page: base } = dashboardChain(bearer, request, apiUrl, pagePath);
  const event = { ...base, params: { brandId } };

  const brand = once(async () => {
    const shell = await org();
    const found = await loadBrandShell((await event.locals.db())!, shell.org.id, brandId);
    if (!found) {
      throw error(NOT_FOUND, 'Brand not found');
    }
    return { ...shell, brand: found };
  });
  const layout = once(async () => (await settingsShell({ ...event, parent: brand } as never)) as Record<string, unknown>);
  const parent = async () => ({ ...(await brand()), ...(await layout()) });
  return { gate: brand, layout, page: { ...event, parent } };
}
