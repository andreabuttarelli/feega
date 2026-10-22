import { expect, gotoHydrated } from './session';
import type { Page } from '@playwright/test';

type Seed = (node: { type: string; x: number; y: number; data: object }) => Promise<{ id: string }>;
type Admin = { from: (table: string) => { insert: (row: object) => PromiseLike<{ error: unknown }> } };
type Session = { orgId: string; userId: string; projectId: string; canvasId: string };

export const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
export const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const TILE_AT = { x: 200, y: 80 };
const CLIP_CENTRE = { x: 392 + 0.3 * 420, y: 356 + 0.5 * 236 };

export const shape = (id: string, extra: object = {}) => ({
  id,
  from: 0,
  durationInFrames: 150,
  component: 'Shape',
  props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.25, height: 0.4, fills: [{ type: 'solid', color: '#ff5a1f' }] },
  ...extra
});

export const docOf = (clips: object[]) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips }],
  comps: {},
  assets: []
});

export async function openTimelineOn(page: Page, deps: { seedNode: Seed; admin: Admin; session: Session }, doc: object) {
  const { seedNode, admin, session } = deps;
  await page.setViewportSize({ width: 1440, height: 900 });
  const node = await seedNode({ type: 'motion', x: TILE_AT.x, y: TILE_AT.y, data: LANDSCAPE });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();

  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
  await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(4000);
  await expect(async () => {
    await page.mouse.click(CLIP_CENTRE.x, CLIP_CENTRE.y);
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 25_000 });
  await page.waitForTimeout(1000);
}
