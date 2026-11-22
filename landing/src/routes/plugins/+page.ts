import { loadPlugins } from '$lib/site/plugins/catalogue';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => ({ plugins: await loadPlugins(fetch) });
