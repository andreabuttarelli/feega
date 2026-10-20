import type { PageLoad } from './$types';
import { loadPageData } from '$lib/api/page-action';
import type { CanvasPageData } from '$lib/server/canvas/canvas-page';

export const ssr = false;

const DOM = 'dom';

function warmRenderer(url: URL) {
  if (typeof window === 'undefined' || url.searchParams.get('renderer') === DOM) {
    return;
  }
  void import('$lib/components/canvas/gpu/GpuFlow.svelte');
  void import('$lib/motion/gpu-full/core-web').then((m) => m.warmCore()).catch(() => undefined);
}

export const load: PageLoad = ({ url }) => {
  warmRenderer(url);
  return loadPageData<CanvasPageData>(url);
};
