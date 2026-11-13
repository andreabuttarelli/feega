import type { PageLoad } from './$types';
import { loadPageData } from '$lib/api/page-action';
import type { CanvasPageData } from '$lib/server/canvas/canvas-page';
import { openCanvasOutbox } from '$lib/canvas/outbox';
import { StartupStep, markStartup } from '$lib/canvas/core/startup-marks';
import { earlySourceUrls } from '$lib/canvas/core/early-sources';
import { frameSources, scopeFrameCache } from '$lib/canvas/core/frame-sources';
import { loadViewport } from '$lib/canvas/viewport-memory';
import { BUDGET, currentDevice } from '$lib/canvas/gpu/memory-budget';

export const ssr = false;

const DOM = 'dom';

function warmRenderer(url: URL) {
  if (typeof window === 'undefined' || url.searchParams.get('renderer') === DOM) {
    return;
  }
  void import('$lib/components/canvas/gpu/GpuFlow.svelte').then(() => markStartup(StartupStep.RendererChunk));
  markStartup(StartupStep.WasmAsked);
  void import('@feega/motion-core/motion/gpu-full/core-web')
    .then((m) => m.warmCore())
    .then(() => markStartup(StartupStep.WasmReady))
    .catch(() => undefined);
}

function warmSources(page: CanvasPageData, params: { projectId: string; canvasId: string }, userId: string | undefined) {
  if (typeof window === 'undefined') {
    return;
  }
  scopeFrameCache(userId ? { userId, orgId: page.orgId } : null);
  const saved = userId ? loadViewport(userId, params.canvasId) : null;
  const screen = { width: window.innerWidth, height: window.innerHeight };
  frameSources.warm(earlySourceUrls(page.nodes, { ...params, orgId: page.orgId, look: page.look }, saved, screen, BUDGET[currentDevice()].readableWidth));
}

export const load: PageLoad = async ({ url, params, parent }) => {
  warmRenderer(url);
  const shell = parent();
  const kept = shell.then((s) => openCanvasOutbox(s.session?.user?.id, params.canvasId));
  const [page, outbox, s] = await Promise.all([loadPageData<CanvasPageData>(url), kept, shell]);
  markStartup(StartupStep.PageData);
  if (url.searchParams.get('renderer') !== DOM) {
    warmSources(page, params, s.session?.user?.id);
  }
  return { ...page, outbox };
};
