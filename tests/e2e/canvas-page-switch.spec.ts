import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const FRAME_DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const DRAWN_MS = 8000;
const INK_DELTA = 10;
const SAMPLES = 24;

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const inked = (label: string) => {
  const base = newMotionDoc(MotionFormat.Landscape);
  const bg = must(addClip(base, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: [{ type: 'solid', color: '#1f5eff' }] } }, 'bg'));
  return must(addClip(bg, { component: 'Text', from: 0, durationInFrames: 90, props: { text: label, size: 0.12, color: '#ffffff', x: 0.5, y: 0.5, width: 0.8, height: 0.3 } }, 'label'));
};

async function inkShare(page: Page, frameId: string): Promise<number> {
  const pane = (await page.locator('[data-canvas-surface]').boundingBox())!;
  const host = await page.locator(`[data-testid="frame-overlays"] [data-frame="${frameId}"]`).boundingBox();
  if (!host) {
    return 0;
  }
  const { data, info } = await sharp(await page.screenshot({ clip: pane })).raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / pane.width;
  const px = (x: number, y: number) => {
    const i = (Math.round(y * scale) * info.width + Math.round(x * scale)) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const ground = px(3, 3);
  const x0 = Math.max(host.x, pane.x) - pane.x;
  const y0 = Math.max(host.y, pane.y) - pane.y;
  const x1 = Math.min(host.x + host.width, pane.x + pane.width) - pane.x;
  const y1 = Math.min(host.y + host.height, pane.y + pane.height) - pane.y;
  if (x1 - x0 < 8 || y1 - y0 < 8) {
    return 0;
  }
  let hit = 0;
  for (let i = 1; i < SAMPLES; i++) {
    for (let j = 1; j < SAMPLES; j++) {
      const p = px(x0 + ((x1 - x0) * i) / SAMPLES, y0 + ((y1 - y0) * j) / SAMPLES);
      hit += p.some((c, k) => Math.abs(c - ground[k]) > INK_DELTA) ? 1 : 0;
    }
  }
  return hit / ((SAMPLES - 1) * (SAMPLES - 1));
}

const drawn = (page: Page, frameId: string) => expect.poll(() => inkShare(page, frameId), { timeout: DRAWN_MS }).toBeGreaterThan(0.5);

test.describe('switching pages draws the canvas @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('a page opened from the pages list, and the one left, draw at once', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const home = await seedNode({ type: 'motion', x: 80, y: 80, data: FRAME_DATA });
    const components = randomUUID();
    expect((await admin.from('canvases').insert({ id: components, org_id: session.orgId, project_id: session.projectId, name: 'Components' })).error).toBeNull();
    const away = randomUUID();
    expect((await admin.from('nodes').insert({ id: away, org_id: session.orgId, project_id: session.projectId, canvas_id: components, type: 'motion', x: 4000, y: 3000, data: FRAME_DATA, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    for (const [nodeId, doc] of [[home.id, inked('Home')], [away, inked('Components')]] as const) {
      expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: nodeId, version: 1, doc, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await drawn(page, home.id);

    await page.getByRole('button', { name: 'Layers', exact: true }).first().click();
    await page.locator('[data-testid="pages"] a.page-link', { hasText: 'Components' }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${components}`));
    await drawn(page, away);

    await page.locator('[data-testid="pages"] a.page-link', { hasText: session.canvasName }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${session.canvasId}`));
    await drawn(page, home.id);
  });
});
