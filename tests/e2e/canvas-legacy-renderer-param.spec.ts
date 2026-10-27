import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LEGACY_RENDERERS = ['webgpu', 'webgl', 'gpu', 'dom'];
const OPEN_TIMEOUT_MS = 30_000;

test.describe('an old ?renderer= link opens the core canvas @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');

  for (const renderer of LEGACY_RENDERERS) {
    test(`?renderer=${renderer}`, async ({ page, session, seedNode }) => {
      await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'legacy link' } });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=${renderer}`);
      await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: OPEN_TIMEOUT_MS });
    });
  }
});
