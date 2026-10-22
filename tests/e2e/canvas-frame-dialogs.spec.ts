import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import path from 'node:path';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.SHOT_PREFIX ?? '';
const TILE_AT = { x: 200, y: 80 };
const SETTLE_MS = 1500;
const BLUE_SQUARE = path.join(import.meta.dirname, 'fixtures', 'blue-square.png');
const VISIBLE_FRACTION = 0.5;
const POSITION_TOLERANCE_PX = 1;

const shape = (id: string, from: number, x: number, color: string) => ({ id, from, durationInFrames: 150 - from, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: 0.25, height: 0.4, fills: [{ type: 'solid', color }] } });
const title = (id: string) => ({ id, from: 0, durationInFrames: 150, component: 'Title', props: { text: 'Hello', color: '#ffffff', font: 'sans', weight: 500, italic: false, size: 0.11, x: 0.7, y: 0.2, width: 0.5, height: 0.2, align: 'center', opacity: 1, scale: 1, rotation: 0 } });
const picture = (id: string) => ({ id, from: 100, durationInFrames: 50, component: 'Image', props: { assetId: null, fit: 'cover', x: 0.85, y: 0.8, width: 0.2, height: 0.2 } });

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('first', 0, 0.3, '#ff5a1f'), title('words'), picture('pic')] }],
  comps: {},
  assets: []
};

const MORE = 'More actions';

const tile = (page: Page) => page.locator('[data-testid="gpu-node"][data-kind="motion"]').first();

async function look(page: Page) {
  const box = await tile(page).boundingBox();
  const png = await page.screenshot({ clip: box! });
  return { box: box!, bytes: png.length };
}

type Look = Awaited<ReturnType<typeof look>>;

async function frameKept(page: Page, before: Look, name: string) {
  await page.waitForTimeout(SETTLE_MS);
  const now = await look(page);
  await page.screenshot({ path: `${SHOTS}-${name}.png` });
  expect(Math.abs(now.box.width - before.box.width)).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  expect(Math.abs(now.box.height - before.box.height)).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  expect(Math.abs(now.box.x - before.box.x)).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  expect(Math.abs(now.box.y - before.box.y)).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  expect(now.bytes).toBeGreaterThan(before.bytes * VISIBLE_FRACTION);
  await expect(tile(page)).toHaveAttribute('data-core', /.*/);
}

async function openFrame(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const surface = page.locator('[data-canvas-surface]');
  await expect(surface).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(4000);
  const click = { x: 392 + 0.3 * 420, y: 356 + 0.5 * 236 };
  await expect(async () => {
    await page.mouse.click(click.x, click.y);
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 25_000 });
  await page.waitForTimeout(SETTLE_MS);
}

async function pickMore(page: Page, label: string) {
  await page.getByRole('button', { name: MORE }).click();
  await page.getByRole('menuitem', { name: label }).click();
}

test.describe('dialogs from a selected canvas frame @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('each dialog opens from the frame, applies a change, and the frame keeps its place', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(300_000);
    const node = await seedNode({ type: 'motion', x: TILE_AT.x, y: TILE_AT.y, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await openFrame(page);
    const before = await look(page);
    await page.screenshot({ path: `${SHOTS}-00-selected.png` });

    const timelineTop = (await page.getByTestId('frame-timeline').boundingBox())!.y;
    const barBottom = (await page.getByTestId('add-bar').boundingBox())!.y + (await page.getByTestId('add-bar').boundingBox())!.height;
    expect(barBottom).toBeLessThanOrEqual(timelineTop);

    await page.getByTestId('frame-timeline').getByText('Title · words').click();
    await page.getByTestId('font-picker').getByRole('button').first().click();
    await page.screenshot({ path: `${SHOTS}-01-fonts.png` });
    const others = page.getByRole('dialog', { name: 'Choose a font' }).locator('ul').first().getByRole('button');
    await expect(others.first()).toBeVisible();
    await page.getByRole('dialog', { name: 'Choose a font' }).getByRole('button', { name: 'Uploaded' }).count();
    await page.keyboard.press('Escape');
    await frameKept(page, before, '01b-fonts-after');

    await page.getByTestId('frame-timeline').getByText('Image · pic').click();
    await page.getByTestId('media-add').click();
    await page.getByTestId('media-file').setInputFiles(BLUE_SQUARE);
    await expect(page.getByTestId('media-preview')).toBeVisible({ timeout: 30_000 });
    await frameKept(page, before, '02-media-uploaded');

    await pickMore(page, 'Interactive…');
    await expect(page.getByTestId('frame-interactive')).toBeVisible();
    await page.getByTestId('frame-interactive').getByText('Interactive · Advanced').click();
    await page.getByLabel('Variable name').fill('speed');
    await page.getByTestId('var-add').click();
    await expect(page.getByTestId('var-speed')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-03-interactive.png` });
    await page.keyboard.press('Escape');
    await page.getByTestId('frame-interactive').getByRole('button', { name: 'Close' }).click();
    await frameKept(page, before, '03b-interactive-after');

    await pickMore(page, 'Chat history…');
    await expect(page.getByTestId('frame-chat')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-04-chat.png` });
    await page.getByTestId('frame-chat').getByRole('button', { name: 'Close' }).click();

    await pickMore(page, 'Version history…');
    await expect(page.getByTestId('frame-revisions')).toBeVisible();
    await page.getByTestId('version-name').fill('before-templates');
    await page.getByTestId('version-name').press('Enter');
    await expect(page.getByTestId('revision').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-05-history.png` });
    await page.getByTestId('frame-revisions').getByRole('button', { name: 'Close' }).click();
    await frameKept(page, before, '05b-history-after');

    await pickMore(page, 'Branches…');
    await expect(page.getByTestId('frame-branches')).toBeVisible();
    await page.getByTestId('branch-name').fill('try-it');
    await page.getByTestId('branch-name').press('Enter');
    await expect(page.getByTestId('branch-open')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}-06-branches.png` });
    await page.getByTestId('frame-branches').getByRole('button', { name: 'Close' }).click();

    await pickMore(page, 'Add voice-over…');
    await expect(page.getByRole('dialog', { name: /voice-over/i })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-07-voice.png` });
    await page.getByRole('dialog', { name: /voice-over/i }).getByRole('button', { name: 'Close' }).click();

    await pickMore(page, 'Components…');
    await expect(page.getByTestId('component-library')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-08-components.png` });
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('component-library')).toBeHidden({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await pickMore(page, 'Templates…');
    await expect(page.getByTestId('template-library')).toBeVisible();
    await page.getByTestId('template-library').locator('.list button').first().click();
    await page.screenshot({ path: `${SHOTS}-09-templates.png` });
    await page.getByTestId('insert-template').click();
    await frameKept(page, before, '09b-templates-after');

    await page.keyboard.press('Escape');
    await pickMore(page, 'Export…');
    await expect(page.getByTestId('export-dialog')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-10-export.png` });
    await page.getByTestId('export-mode-images').click();
    await page.getByTestId('export-go').click();
    await expect(page.getByTestId('export-file')).toBeVisible({ timeout: 90_000 });
    await page.screenshot({ path: `${SHOTS}-11-export-images.png` });
    await page.getByTestId('export-dialog').getByRole('button', { name: 'Close' }).click();

    await pickMore(page, 'Export…');
    await page.getByTestId('export-mode-video').click();
    await page.getByTestId('export-start').click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}-12-export-video-running.png` });
    await expect(page.getByTestId('export-download')).toBeVisible({ timeout: 150_000 });
    await page.screenshot({ path: `${SHOTS}-13-export-video-done.png` });
    await page.getByTestId('export-dialog').getByRole('button', { name: 'Close' }).click();
    await frameKept(page, before, '14-after-export');
  });
});
