import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { pickBarTool } from './fixtures/canvas-bar';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

type Clip = { id: string; component: string; props: { fills?: unknown[]; strokes?: unknown[] } };

const SHOTS = process.env.CANVAS_MOTION_SHOTS;

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function elementIds(admin: SupabaseClient, canvasId: string): Promise<string[]> {
  const { data } = await admin.from('nodes').select('id, data').eq('canvas_id', canvasId).is('deleted_at', null);
  return (data ?? []).filter((n) => (n.data as { kind?: string }).kind === 'element').map((n) => n.id as string);
}

async function clipOf(admin: SupabaseClient, nodeId: string): Promise<Clip | undefined> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const doc = data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined;
  return doc?.tracks.flatMap((t) => t.clips)[0];
}

async function drawBox(page: Page) {
  const bar = page.getByTestId('add-bar');
  await pickBarTool(page, 'rectangle');
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.3, y: pane.y + pane.height * 0.35 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y + 60);
  await page.mouse.move(from.x + 240, from.y + 120);
  await page.mouse.up();
}

test.describe('a shape with no layers left @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a free box: remove every fill and stroke, + adds them back and they persist', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await drawBox(page);
    await expect.poll(async () => (await elementIds(admin, session.canvasId)).length, { timeout: 15_000 }).toBe(1);
    const [nodeId] = await elementIds(admin, session.canvasId);

    const props = page.locator('aside.props');
    await expect(props.getByTestId('selection-head')).toContainText('Shape', { timeout: 20_000 });
    const fill = props.locator('[data-section="fill"]');
    const rows = fill.getByTestId('fill-row');
    while ((await rows.count()) > 0) {
      await rows.first().getByTestId('fill-remove').click();
    }
    await expect.poll(async () => (await clipOf(admin, nodeId))?.props.fills, { timeout: 15_000 }).toEqual([]);
    await shoot(page, 'empty-fills');

    await fill.getByTestId('fill-add').click();
    await page.getByRole('menuitem', { name: 'Solid', exact: true }).click();
    await shoot(page, 'after-add');
    await expect(props.locator('[data-section="fill"]').getByTestId('fill-row')).toHaveCount(1);
    await expect.poll(async () => (await clipOf(admin, nodeId))?.props.fills?.length, { timeout: 15_000 }).toBe(1);

    const stroke = props.locator('[data-section="stroke"]');
    await stroke.getByTestId('stroke-add').click();
    await expect.poll(async () => (await clipOf(admin, nodeId))?.props.strokes?.length, { timeout: 15_000 }).toBe(1);
    await stroke.getByTestId('stroke-row').first().getByTestId('stroke-remove').click();
    await expect.poll(async () => (await clipOf(admin, nodeId))?.props.strokes, { timeout: 15_000 }).toEqual([]);
    await props.locator('[data-section="stroke"]').getByTestId('stroke-add').click();
    await expect.poll(async () => (await clipOf(admin, nodeId))?.props.strokes?.length, { timeout: 15_000 }).toBe(1);

    await page.reload();
    await expect.poll(async () => (await clipOf(admin, nodeId))?.props.fills?.length, { timeout: 15_000 }).toBe(1);
  });
});
