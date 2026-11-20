import type { PageLoad } from './$types';
import { loadBootstrap } from '$lib/dashboard/api';

export const load: PageLoad = async ({ depends }) => {
  const { flags } = await loadBootstrap(depends);
  return { name: flags.name };
};
