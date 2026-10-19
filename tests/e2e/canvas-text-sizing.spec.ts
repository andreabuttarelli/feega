import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';

const FROM = { x: 360, y: 300 };

async function only(admin: SupabaseClient, session: E2eSession) {
  const { data } = await admin.from('nodes').select('id, width, height').eq('canvas_id', session.canvasId).is('deleted_at', null);
  return data?.[0] ?? null;
}

async function sizingOf(admin: SupabaseClient, nodeId: string) {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const doc = data?.[0]?.doc as { tracks: { clips: { props: { sizing?: string; text?: string } }[] }[] } | undefined;
  return doc?.tracks.flatMap((t) => t.clips)[0]?.props ?? null;
}

const editable = (page: Page) => page.frameLocator('[data-testid="motion-preview"] iframe').first().locator('[contenteditable]');

test.describe('a free text sizes itself like its resizing says @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a dragged text keeps its width and grows taller as it wraps', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await pickBarTool(page, 'text');
    await page.mouse.move(FROM.x, FROM.y);
    await page.mouse.down();
    await page.mouse.move(FROM.x + 150, FROM.y + 20);
    await page.mouse.move(FROM.x + 300, FROM.y + 40);
    await page.mouse.up();

    await expect(editable(page)).toHaveCount(1, { timeout: 15_000 });
    await page.keyboard.type('a long line that has to wrap onto several lines inside the box');
    await page.keyboard.press('Escape');

    await expect.poll(async () => (await sizingOf(admin, (await only(admin, session))!.id))?.text, { timeout: 15_000 }).toContain('wrap');
    expect((await sizingOf(admin, (await only(admin, session))!.id))?.sizing).toBe('auto-height');
    await expect.poll(async () => (await only(admin, session))?.height ?? 0, { timeout: 15_000 }).toBeGreaterThan(60);
    expect(Math.abs(((await only(admin, session))?.width ?? 0) - 300)).toBeLessThanOrEqual(1);
  });

  test('a clicked text grows wider with its line', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await pickBarTool(page, 'text');
    await page.mouse.click(FROM.x, FROM.y);
    await expect(editable(page)).toHaveCount(1, { timeout: 15_000 });
    await page.keyboard.type('Hi');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await only(admin, session))?.width ?? 0, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await only(admin, session))?.width ?? 999, { timeout: 15_000 }).toBeLessThan(150);
    const narrow = (await only(admin, session))!.width;
    expect(narrow).toBeGreaterThan(10);
    expect((await sizingOf(admin, (await only(admin, session))!.id))?.sizing).toBe('auto');

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.mouse.click(900, 700);
    await page.waitForTimeout(800);
    const tile = (await page.locator(`[data-testid="gpu-node"][data-id="${(await only(admin, session))!.id}"]`).boundingBox())!;
    await page.mouse.dblclick(tile.x + tile.width / 2, tile.y + tile.height / 2);
    await expect(editable(page)).toHaveCount(1, { timeout: 15_000 });
    await page.keyboard.press('End');
    await page.keyboard.type(' and a much longer line');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await only(admin, session))?.width ?? 0, { timeout: 15_000 }).toBeGreaterThan(narrow * 2);
  });
});
