import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated, signInE2e } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const DESKTOP = { width: 1280, height: 860 };
const FRAME_DATA = { format: 'landscape', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SAVED_MS = 1500;

test.use({ viewport: DESKTOP, actionTimeout: 15_000 });

async function setOpacity(page: Page, clipId: string, value: string) {
  await page.locator(`[data-clip-id="${clipId}"]`).first().click();
  await page.getByRole('tab', { name: 'Properties', exact: true }).click();
  const field = page.locator('input.num[aria-label="Opacity"]').first();
  if (!(await field.isVisible())) {
    await page.locator('[data-section="layout"] .section-head').first().click();
  }
  await field.fill(value);
  await field.press('Enter');
  await page.waitForTimeout(SAVED_MS);
}

async function headOpacity(admin: SupabaseClient, nodeId: string, clipId: string): Promise<number> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const head = data?.[0]?.doc as typeof doc;
  const clip = head.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId) as { transform?: { opacity?: number } } | undefined;
  return clip?.transform?.opacity ?? 1;
}

test.describe('branching a frame @real', () => {
  test.skip(!REAL_STACK, 'richiede lo stack vero: E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('branch, edit both sides, review the conflict, keep the branch value, merge back', async ({ page, browser, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: FRAME_DATA });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    const clipId = doc.tracks[0].clips[0].id;
    const framePath = `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`;

    await gotoHydrated(page, framePath);
    await page.getByTestId('branches-open').click({ timeout: 30_000 });
    await page.getByTestId('branch-name').fill('try');
    await page.getByTestId('branch-name').press('Enter');
    await page.waitForURL((url) => !url.pathname.endsWith(node.id), { timeout: 15_000 });
    const branchId = page.url().split('/motion/')[1].split(/[?#]/)[0];
    await setOpacity(page, clipId, '40');

    const elsewhere = await browser.newContext({ viewport: DESKTOP });
    const other = await elsewhere.newPage();
    await signInE2e(other, { email: session.email, password: session.password });
    await gotoHydrated(other, framePath);
    await setOpacity(other, clipId, '60');
    await expect.poll(() => headOpacity(admin, node.id, clipId), { timeout: 15_000 }).toBe(0.6);

    await page.getByTestId('branches-open').click({ timeout: 30_000 });
    await page.getByTestId('branch-review').click({ timeout: 30_000 });
    await expect(page.getByTestId('branch-conflict')).toHaveCount(1);
    await page.getByTestId('keep-branch').check();
    await page.getByTestId('branch-merge').click();
    await page.waitForURL((url) => url.pathname.endsWith(node.id), { timeout: 15_000 });

    await expect.poll(() => headOpacity(admin, node.id, clipId), { timeout: 15_000 }).toBe(0.4);
    const { data: branchRow } = await admin.from('nodes').select('deleted_at').eq('id', branchId).single();
    expect(branchRow?.deleted_at).not.toBeNull();
    const { data: listed } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null);
    expect(listed?.some((n) => n.id === branchId)).toBe(false);
    await elsewhere.close();
  });
});
