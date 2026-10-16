import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

type Clip = { id: string; component: string; props: Record<string, unknown> };

enum Theme {
  Light = 'light',
  Dark = 'dark'
}

enum Gesture {
  Click = 'click',
  Drag = 'drag'
}

const DRAG = { width: 300, height: 100 };
const INK_DELTA = 80;
const MIN_INK_PIXELS = 150;
const SHOTS = process.env.CANVAS_TEXT_SHOTS;

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

async function elements(admin: SupabaseClient, session: E2eSession) {
  const { data } = await admin.from('nodes').select('id, data, width, height').eq('canvas_id', session.canvasId).is('deleted_at', null);
  return (data ?? []).filter((n) => (n.data as { kind?: string }).kind === 'element');
}

async function clipsOf(admin: SupabaseClient, nodeId: string): Promise<Clip[]> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const doc = data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined;
  return doc?.tracks.flatMap((t) => t.clips) ?? [];
}

async function inkPixels(page: Page, nodeId: string): Promise<{ count: number; height: number }> {
  const tile = page.locator(`[data-motion-node="${nodeId}"]`);
  const box = (await tile.boundingBox())!;
  const pad = 12;
  const shot = await page.screenshot({ clip: { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 } });
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (i: number) => data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2];
  const background = at(0);
  const rows = new Set<number>();
  let count = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    if (Math.abs(at(i) - background) / 3 > INK_DELTA) {
      count++;
      rows.add(Math.floor(i / info.width));
    }
  }
  return { count, height: rows.size };
}

async function draw(page: Page, gesture: Gesture) {
  await page.getByTestId('add-bar').getByTestId('draw-tools').locator('[data-tool="text"]').click();
  await expect(page.getByTestId('canvas-draw')).toBeVisible();
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.3, y: pane.y + pane.height * 0.35 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (gesture === Gesture.Drag) {
    await page.mouse.move(from.x + DRAG.width / 2, from.y + DRAG.height / 2);
    await page.mouse.move(from.x + DRAG.width, from.y + DRAG.height);
  }
  await page.mouse.up();
  return pane;
}

async function leave(page: Page, pane: { x: number; y: number; height: number }) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('add-bar')).toHaveAttribute('data-context', 'canvas', { timeout: 10_000 });
  await page.mouse.click(pane.x + 20, pane.y + pane.height - 120);
}

async function posterOfHead(admin: SupabaseClient, nodeId: string) {
  await expect
    .poll(
      async () => {
        const { data } = await admin.from('nodes').select('data').eq('id', nodeId).single();
        const d = data?.data as { docHeadRevision?: number; posterRevision?: number };
        return d.posterRevision === d.docHeadRevision;
      },
      { timeout: 30_000, message: 'the canvas poster pictures the edited text, not the first draft' }
    )
    .toBe(true);
}

async function visibleText(page: Page, nodeId: string) {
  await expect(page.locator(`[data-motion-node="${nodeId}"]`)).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => (await inkPixels(page, nodeId)).count, { timeout: 20_000, message: 'the text paints real pixels on the canvas' }).toBeGreaterThan(MIN_INK_PIXELS);
}

test.describe('free text on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  const cases = [
    { gesture: Gesture.Drag, theme: Theme.Light },
    { gesture: Gesture.Click, theme: Theme.Light },
    { gesture: Gesture.Drag, theme: Theme.Dark }
  ];

  for (const { gesture, theme } of cases) {
    test(`a text made by ${gesture} on a ${theme} canvas shows what was typed, in the drawn box, after a reload`, async ({ page, session, admin }) => {
      test.setTimeout(150_000);
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

      const pane = await draw(page, gesture);
      await expect.poll(async () => (await elements(admin, session)).length, { timeout: 10_000 }).toBe(1);
      const [element] = await elements(admin, session);
      if (gesture === Gesture.Drag) {
        expect(element.width).toBeCloseTo(DRAG.width, -1);
        expect(element.height).toBeCloseTo(DRAG.height, -1);
      }

      await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('aside.props textarea').first(), 'typing goes straight into the new text').toBeFocused({ timeout: 15_000 });
      await page.keyboard.type('Hello');
      await leave(page, pane);
      await expect.poll(async () => (await clipsOf(admin, element.id)).map((c) => c.props.text), { timeout: 10_000 }).toEqual(['Hello']);

      await posterOfHead(admin, element.id);
      await visibleText(page, element.id);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/${gesture}-${theme}.png` });
      }
      expect(await elements(admin, session), 'one element, not a box plus a text').toHaveLength(1);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await visibleText(page, element.id);
      const [after] = await elements(admin, session);
      expect([after.width, after.height]).toEqual([element.width, element.height]);
    });
  }

  test('the Size field in Properties resizes the rendered text and survives a reload', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const pane = await draw(page, Gesture.Drag);
    await expect.poll(async () => (await elements(admin, session)).length, { timeout: 10_000 }).toBe(1);
    const [element] = await elements(admin, session);
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('aside.props textarea').first()).toBeFocused({ timeout: 15_000 });
    await page.keyboard.type('Hello');
    await leave(page, pane);
    await expect.poll(async () => (await clipsOf(admin, element.id)).map((c) => c.props.text), { timeout: 10_000 }).toEqual(['Hello']);
    await page.waitForTimeout(8000);
    console.log('DBG', JSON.stringify((await admin.from('nodes').select('data').eq('id', element.id).single()).data));
    await page.screenshot({ path: `${process.env.SHOTS_DIR}/dbg-size.png` });
    await posterOfHead(admin, element.id);
    await visibleText(page, element.id);
    const before = await inkPixels(page, element.id);
    const sizeBefore = Number((await clipsOf(admin, element.id))[0].props.size);

    await page.locator(`[data-motion-node="${element.id}"]`).dblclick();
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
    const field = page.locator('aside.props [data-field="Size"] input');
    await field.scrollIntoViewIfNeeded();
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/size-inspector.png` });
    }
    const props = page.locator('aside.props');
    for (const name of ['Weight', 'Size', 'Tracking', 'Leading']) {
      await expect(props.locator(`[data-field="${name}"]`), `${name} is in the inspector`).toBeVisible();
    }
    for (const label of ['Font', 'Align', 'Box width', 'Fill']) {
      await expect(props.getByText(label, { exact: true }).first(), `${label} is in the inspector`).toBeAttached();
    }
    const shownPx = Number(await field.inputValue());
    await field.fill(String(Math.round(shownPx / 2)));
    await field.press('Enter');
    await expect.poll(async () => Number((await clipsOf(admin, element.id))[0].props.size), { timeout: 10_000 }).toBeLessThan(sizeBefore);
    await leave(page, pane);
    await posterOfHead(admin, element.id);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await visibleText(page, element.id);
    await expect.poll(async () => (await inkPixels(page, element.id)).height, { timeout: 20_000, message: 'smaller type paints fewer rows' }).toBeLessThan(before.height * 0.8);
  });
});
