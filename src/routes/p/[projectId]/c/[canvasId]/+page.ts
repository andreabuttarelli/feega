import type { PageLoad } from './$types';
import { loadPageData } from '$lib/api/page-action';
import type { CanvasPageData } from '$lib/server/canvas/canvas-page';
import { openCanvasOutbox } from '$lib/canvas/outbox';

export const ssr = false;

const DOM = 'dom';

function warmRenderer(url: URL) {
  if (typeof window === 'undefined' || url.searchParams.get('renderer') === DOM) {
    return;
  }
  void import('$lib/components/canvas/gpu/GpuFlow.svelte');
  void import('@feega/motion-core/motion/gpu-full/core-web').then((m) => m.warmCore()).catch(() => undefined);
}

export const load: PageLoad = async ({ url, params, parent }) => {
  warmRenderer(url);
  const kept = parent().then((shell) => openCanvasOutbox(shell.session?.user?.id, params.canvasId));
  const [page, outbox] = await Promise.all([loadPageData<CanvasPageData>(url), kept]);
  return { ...page, outbox };
};
