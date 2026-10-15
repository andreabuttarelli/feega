import type { LayoutLoad } from './$types';
import { loadBootstrap } from '$lib/dashboard/api';

export const ssr = false;

export const load: LayoutLoad = async ({ depends }) => {
  const { shell } = await loadBootstrap(depends);
  return shell;
};
