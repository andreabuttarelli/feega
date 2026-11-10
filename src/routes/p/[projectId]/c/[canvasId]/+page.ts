import type { PageLoad } from './$types';
import { loadPageData } from '$lib/api/page-action';
import type { CanvasPageData } from '$lib/server/canvas/canvas-page';
import { openCanvasOutbox } from '$lib/canvas/outbox';
import { openingSources } from '$lib/canvas/core/frame-source';
import { frameSources } from '$lib/canvas/core/frame-sources';
import { loadViewport } from '$lib/canvas/viewport-memory';

const WHOLE_CANVAS = { x: 0, y: 0, zoom: 1 };

function askSources(page: CanvasPageData, userId: string | undefined) {
  if (typeof window === 'undefined') {
    return;
  }
  const view = (userId ? loadViewport(userId, page.canvas.id) : null) ?? page.canvas.viewport ?? WHOLE_CANVAS;
  const place = { projectId: page.canvas.projectId, canvasId: page.canvas.id, orgId: page.orgId };
  frameSources.warm(openingSources(page.nodes, place, view, { width: window.innerWidth, height: window.innerHeight }));
}

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
  const shell = parent();
  const [page, outbox] = await Promise.all([loadPageData<CanvasPageData>(url).then(async (page) => (askSources(page, (await shell).session?.user?.id), page)), kept]);
  return { ...page, outbox };
};
