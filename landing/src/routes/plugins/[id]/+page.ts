import { error } from '@sveltejs/kit';
import { PLUGINS } from '$lib/site/plugins/plugins';
import type { EntryGenerator, PageLoad } from './$types';

const NOT_FOUND = 404;

export const entries: EntryGenerator = () => PLUGINS.map(({ id }) => ({ id }));

export const load: PageLoad = ({ params }) => {
  const plugin = PLUGINS.find((p) => p.id === params.id);
  if (!plugin) {
    error(NOT_FOUND, 'Plugin not found');
  }

  return { plugin };
};
