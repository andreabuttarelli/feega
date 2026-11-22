import { error } from '@sveltejs/kit';
import { loadPlugins } from '$lib/site/plugins/catalogue';
import type { EntryGenerator, PageLoad } from './$types';

const NOT_FOUND = 404;

export const entries: EntryGenerator = async () => (await loadPlugins(fetch)).map(({ id }) => ({ id }));

export const load: PageLoad = async ({ fetch, params }) => {
  const plugin = (await loadPlugins(fetch)).find((p) => p.id === params.id);
  if (!plugin) {
    error(NOT_FOUND, 'Plugin not found');
  }

  return { plugin };
};
