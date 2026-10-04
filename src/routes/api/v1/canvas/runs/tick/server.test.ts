import { describe, expect, it, vi } from 'vitest';

const order: string[] = [];
const step = (name: string, result: unknown) => vi.fn(async () => {
  order.push(name);
  return result;
});

vi.mock('$lib/server/cron-auth', () => ({ cronAuthorized: () => true }));
vi.mock('$lib/server/db/client', () => ({ createServiceRoleDb: () => ({}) }));
vi.mock('$lib/server/canvas/generate', () => ({
  reconcileVideoNodeRuns: step('videos', {}),
  reconcileAudioNodeRuns: step('audios', {}),
  reconcileWiroNodeRuns: step('wiro', {}),
  expireStuckRuns: step('expire', {})
}));
vi.mock('$lib/server/canvas/loop', () => ({ drainLoopQueue: step('loops', {}) }));
vi.mock('$lib/server/canvas/workflow', () => ({ drainWorkflowQueue: step('workflows', {}) }));
vi.mock('$lib/server/canvas/retention', () => ({ pruneOldCanvasEvents: step('events', {}) }));
vi.mock('$lib/server/account-billing', () => ({ renewAccountSeats: step('seats', {}) }));
vi.mock('$lib/server/provider-purgers', () => ({ configuredPurgers: () => ({}) }));
vi.mock('$lib/server/reports/report-deps', () => ({ reportDeps: () => ({}) }));
vi.mock('$lib/server/reports/reports', () => ({ restoreDueReports: step('reports', { restored: 1 }) }));
vi.mock('$lib/server/motion/renderer', () => ({ motionRenderFarm: () => ({}), motionRenderStorage: () => ({}) }));
vi.mock('$lib/server/motion/render-run', () => ({ reconcileRenders: step('renders', { checked: 1, done: 1, failed: 0, pending: 0 }) }));
vi.mock('$lib/server/canvas/provider-purge', () => ({ purgeProviderCopies: step('purge', { purged: 2, waiting: 0, failed: 0 }) }));

describe('the canvas run tick', () => {
  it('purges provider copies after the runs that land them, and reports it', async () => {
    const { GET } = await import('./+server');

    const res = await GET({ request: new Request('https://x.test') } as Parameters<typeof GET>[0]);

    expect(order.indexOf('purge')).toBeGreaterThan(order.indexOf('wiro'));
    expect(order.indexOf('purge')).toBeGreaterThan(order.indexOf('audios'));
    expect((await res.json()).purge).toEqual({ purged: 2, waiting: 0, failed: 0 });
  });

  it('finalises motion renders that their workers finished outside any request, before the stuck-run sweep', async () => {
    const { GET } = await import('./+server');

    const res = await GET({ request: new Request('https://x.test') } as Parameters<typeof GET>[0]);

    expect(order.indexOf('renders')).toBeLessThan(order.indexOf('expire'));
    expect((await res.json()).renders).toEqual({ checked: 1, done: 1, failed: 0, pending: 0 });
  });

  it('restores DMCA content whose counter-notice period has run out', async () => {
    const { GET } = await import('./+server');

    const res = await GET({ request: new Request('https://x.test') } as Parameters<typeof GET>[0]);

    expect((await res.json()).reports).toEqual({ restored: 1 });
  });
});
