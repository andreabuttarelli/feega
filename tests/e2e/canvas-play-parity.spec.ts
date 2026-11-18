import { mkdirSync, writeFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import sharp from 'sharp';
import { ssim } from './fixtures/ssim';
import { baseFixtures } from '@feega/motion-core/motion/codegen/fixtures/responsive';
import { viewsOf } from '@feega/motion-core/motion/breakpoints/model';

const SHOTS_DIR = process.env.PLAY_SHOTS_DIR ?? `${process.env.HOME}/Documents/feega-videos/shots/play-mode`;
const STAGE = { width: 2400, height: 1300 };
const SETTLE_MS = 5000;
const MIN_SSIM = 0.98;
const TOOLBAR_PX = 80;
const CASES = (process.env.PLAY_CASES ?? 'hero-phone,features-grid,view-only-layers,component-main-override,landing,landing-tall').split(',');
const DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const NODE_SCALE = 1;

const TALL = '-tall';
const TALL_PX = 9600;
const fixtureDoc = (name: string) => {
  const doc = baseFixtures().find((f) => f.name === name.replace(TALL, ''))!.doc;
  return name.endsWith(TALL) ? { ...doc, height: TALL_PX } : doc;
};

type Seen = { png: Buffer; shown: number; width: number };

async function seen(page: Page, target: Locator, bottom: number): Promise<Seen> {
  const box = (await target.boundingBox())!;
  const height = Math.min(box.height, bottom - box.y);
  return { png: await page.screenshot({ clip: { ...box, height } }), shown: height / box.width, width: box.width };
}

async function topOf(s: Seen, shown: number): Promise<Buffer> {
  const meta = await sharp(s.png).metadata();
  return sharp(s.png).extract({ left: 0, top: 0, width: meta.width!, height: Math.max(1, Math.min(meta.height!, Math.floor(meta.width! * shown))) }).png().toBuffer();
}

const WINDOW = 8;
const toWindow = (n: number) => Math.max(WINDOW * 4, Math.floor(n / WINDOW) * WINDOW);

async function compared(canvas: Seen, played: Seen) {
  const shown = Math.min(canvas.shown, played.shown);
  const [a, b] = await Promise.all([topOf(canvas, shown), topOf(played, shown)]);
  const meta = await sharp(a).metadata();
  return { a, b, score: await ssim(a, b, { width: toWindow(meta.width!), height: toWindow(meta.height!) }) };
}

const save = (name: string, png: Buffer) => {
  mkdirSync(SHOTS_DIR, { recursive: true });
  writeFileSync(`${SHOTS_DIR}/${name}.png`, png);
};

const FRAME_MARGIN = 80;

async function zoomOnto(page: Page, target: Locator) {
  await page.mouse.move(STAGE.width / 2, STAGE.height / 2);
  await page.keyboard.press('Shift+Digit0');
  await page.waitForTimeout(SETTLE_MS);
  const box = (await target.boundingBox())!;
  await page.mouse.move(STAGE.width / 2, STAGE.height / 2);
  await page.mouse.wheel(box.x - FRAME_MARGIN, box.y - FRAME_MARGIN);
  await page.mouse.move(STAGE.width - 1, STAGE.height / 2);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(SETTLE_MS);
}

const HEADER_PAD = 24;
const NARROW_WINDOW = { width: 400, height: 900 };

async function openPlay(page: Page, nodeId: string, name: string) {
  const tile = (await page.locator(`[data-frame="${nodeId}"]`).first().boundingBox())!;
  save(`${name}-header`, await page.screenshot({ clip: { x: tile.x - HEADER_PAD, y: tile.y - HEADER_PAD * 2, width: tile.width + HEADER_PAD * 2, height: HEADER_PAD * 3 } }));
  await page.locator(`[data-testid="frame-header-icon"][data-badge="play"][data-node="${nodeId}"]`).click();
  await expect(page.getByTestId('prototype-player')).toBeVisible({ timeout: 15_000 });
}

test.describe('Play paints each view like the canvas @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(300_000);

  for (const name of CASES) {
    test(name, async ({ page, session, admin, seedNode }) => {
      const doc = fixtureDoc(name);
      await page.setViewportSize(STAGE);
      const node = await seedNode({ type: 'motion', x: 0, y: 0, data: DATA });
      await admin.from('nodes').update({ width: doc.width * NODE_SCALE, height: doc.height * NODE_SCALE }).eq('id', node.id);
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
      await page.waitForTimeout(SETTLE_MS);
      save(`${name}-canvas`, await page.screenshot());

      const canvasShots = new Map<string, Seen>();
      for (const view of viewsOf(doc)) {
        const tile = page.locator(`[data-frame="${view.id === viewsOf(doc)[0].id ? node.id : `${node.id}@bp:${view.id}`}"]`).first();
        await expect(tile).toHaveCount(1, { timeout: 30_000 });
        await zoomOnto(page, tile);
        canvasShots.set(view.id, await seen(page, tile, STAGE.height - TOOLBAR_PX));
      }
      await page.keyboard.press('Shift+Digit1');
      await page.waitForTimeout(SETTLE_MS);

      await openPlay(page, node.id, name);
      const scores: Record<string, number> = {};
      for (const view of viewsOf(doc)) {
        await page.getByTestId(`viewport-${view.width}`).click();
        await page.waitForTimeout(SETTLE_MS);
        await expect(page.locator('[data-testid="prototype-player"] [data-testid="motion-preview"]').first()).not.toHaveAttribute('data-engine', 'html');
        const played = await seen(page, page.locator('[data-testid="prototype-player"] .viewport'), STAGE.height);
        const { a, b, score } = await compared(canvasShots.get(view.id)!, played);
        save(`${name}-${view.id}-canvas`, a);
        save(`${name}-${view.id}-play`, b);
        save(`${name}-${view.id}-player`, await page.screenshot());
        scores[view.id] = score;
      }
      console.log(`PLAY-PARITY ${name} ${JSON.stringify(scores)}`);

      await page.getByTestId('viewport-window').click();
      await page.setViewportSize(NARROW_WINDOW);
      await expect(page.getByTestId('viewport-readout')).toContainText(viewsOf(doc).at(-1)!.name);
      save(`${name}-window-narrow`, await page.screenshot());

      for (const [view, score] of Object.entries(scores)) {
        expect(score, `${name} ${view}`).toBeGreaterThanOrEqual(MIN_SSIM);
      }
    });
  }
});
