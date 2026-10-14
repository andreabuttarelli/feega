import { mkdirSync } from 'node:fs';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const DESKTOP = { width: 1440, height: 900 };
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const TIMELINE_MAX_PX = 230;
const SETTLE_MS = 700;
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

test.use({ viewport: DESKTOP, video: SHOTS ? { mode: 'on', size: DESKTOP } : 'off' });

const viewportTransform = (page: Page) => page.locator('.svelte-flow__viewport').evaluate((el) => getComputedStyle(el).transform);

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.describe('the canvas around the inline editor on desktop @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(90_000);

  test('the canvas stays put, the add bar leaves and returns, the timeline is low', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', x: 80, y: 120, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    const transform = await viewportTransform(page);
    const addBar = page.getByTestId('add-bar');
    await expect(addBar).toHaveAttribute('data-shown', 'shown');
    const barBox = (await addBar.boundingBox())!;
    expect(Math.abs(barBox.y + barBox.height - DESKTOP.height), 'the add bar sits flush on the bottom edge').toBeLessThanOrEqual(2);
    await shoot(page, 'desktop-closed');

    await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
    await page.waitForTimeout(SETTLE_MS);
    await shoot(page, 'desktop-open');

    expect(await viewportTransform(page), 'desktop does not zoom or pan the canvas on open').toBe(transform);
    await expect(addBar, 'the add bar leaves while a frame is edited').toHaveAttribute('data-shown', 'away');
    expect((await addBar.boundingBox())?.y ?? DESKTOP.height, 'out of view').toBeGreaterThanOrEqual(DESKTOP.height);

    const timeline = (await page.getByRole('region', { name: 'Timeline', exact: true }).boundingBox())!;
    expect(timeline.height, 'the timeline opens low, about three tracks').toBeLessThanOrEqual(TIMELINE_MAX_PX);

    await page.getByTestId('inline-close').click();
    await expect(page.getByTestId('motion-editor')).toHaveCount(0);
    await expect(addBar).toHaveAttribute('data-shown', 'shown');
    await page.waitForTimeout(SETTLE_MS);
    await expect(addBar).toBeInViewport();
    await shoot(page, 'desktop-closed-again');
  });

  test('a still poster picked from the add bar becomes a frame on the canvas, saved', async ({ page, session, admin }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('frame-templates').click();
    await page.locator('[data-mode-tab="still"]').click();
    await shoot(page, 'desktop-frame-templates');
    await page.locator('[data-mode="still"][data-component]').first().click();

    await expect(page.locator('[data-testid=motion-node]')).toHaveCount(1, { timeout: 15_000 });
    await expect
      .poll(async () => (await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null)).data?.length ?? 0, { message: 'the frame is saved' })
      .toBe(1);
    await shoot(page, 'desktop-frame-added');
  });
});
