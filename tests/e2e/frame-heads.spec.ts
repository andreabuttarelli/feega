import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated, signInE2e } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const DESKTOP = { width: 1280, height: 860 };
const FRAME_DATA = { format: 'landscape', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PEER_LATENCY_MS = 1000;

test.use({ viewport: DESKTOP, actionTimeout: 15_000 });

async function opacityOf(page: Page, clipId: string) {
  await page.locator(`[data-clip-id="${clipId}"]`).first().click();
  await page.getByRole('tab', { name: 'Properties', exact: true }).click();
  const field = page.locator('input.num[aria-label="Opacity"]').first();
  if (!(await field.isVisible())) {
    await page.locator('[data-section="layout"] .section-head').first().click();
  }
  return field;
}

test.describe('a frame edit in one tab reaches the other @real', () => {
  test.skip(!REAL_STACK, 'richiede lo stack vero: E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('the saved revision is announced, not polled', async ({ page, browser, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: FRAME_DATA });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    const clipId = doc.tracks[0].clips[0].id;
    const path = `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`;
    const elsewhere = await browser.newContext({ viewport: DESKTOP });
    const other = await elsewhere.newPage();
    await signInE2e(other, { email: session.email, password: session.password });
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);
    const watched = await opacityOf(other, clipId);
    await page.waitForTimeout(1500);

    const field = await opacityOf(page, clipId);
    await field.fill('40');
    const started = Date.now();
    await field.press('Enter');
    await expect(watched).toHaveValue(/^40/, { timeout: 10_000 });
    const latency = Date.now() - started;
    console.log(JSON.stringify({ frameEditPeerLatencyMs: latency }));
    expect(latency).toBeLessThan(PEER_LATENCY_MS);
    await elsewhere.close();
  });
});
