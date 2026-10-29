import { mkdirSync } from 'node:fs';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SETTLE_MS = 700;
const SHOTS = process.env.MODE_SWITCH_SHOTS;

async function shoot(page: Page, name: string) {
  if (!SHOTS) {
    return;
  }
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.describe('Motion records, Design scrubs @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('Motion draws a recording border, Design opens the timeline with ⌘J', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 120, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId('motion-node-stage').dblclick({ position: { x: 40, y: 40 } });
    const modeSwitch = page.getByRole('radiogroup', { name: 'Editor mode' });
    const canvas = page.locator('[data-canvas-surface]');
    const timeline = page.getByTestId('frame-timeline');

    await modeSwitch.getByRole('radio', { name: 'Motion' }).click();
    await expect(canvas).toHaveAttribute('data-mode-chrome', 'recording');
    await expect(timeline).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    await shoot(page, 'motion-recording');

    await modeSwitch.getByRole('radio', { name: 'Design' }).click();
    await expect(canvas).toHaveAttribute('data-mode-chrome', 'plain');
    await expect(timeline).toBeHidden();
    await page.keyboard.press('Meta+j');
    await expect(canvas).toHaveAttribute('data-timeline', 'scrub');
    await expect(timeline).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    await shoot(page, 'motion-design-scrub');
  });
});
