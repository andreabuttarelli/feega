import { homedir } from 'node:os';
import type { Page } from '@playwright/test';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent } from '../../src/lib/motion/main-component';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/editor-modes`;
const SETTLE_MS = 2500;
const FRAME_DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

type Clip = { component: string; props: { comp?: string } };
type Head = { tracks: { clips: Clip[] }[] };

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const button = must(createComponent(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy now', size: 0.12, x: 0.5, y: 0.5, width: 0.6, height: 0.25 } }, 'label')), ['label'], () => `e2e${++n}`, 'Button'));
const blank = newMotionDoc(MotionFormat.Landscape);

async function openComponents(page: Page) {
  await page.getByRole('button', { name: 'Components', exact: true }).first().click();
  const row = page.getByTestId('component-row').first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  return row;
}

async function dropAt(page: Page, from: ReturnType<Page['getByTestId']>, client: { x: number; y: number }) {
  const surface = page.locator('[data-canvas-surface]');
  const box = (await surface.boundingBox())!;
  await from.dragTo(surface, { targetPosition: { x: client.x - box.x, y: client.y - box.y } });
}

test.describe('dragging a component from the Components panel @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('drop on a frame inserts an instance, drop on empty canvas makes a free one', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const source = await seedNode({ type: 'motion', x: 80, y: 80, data: FRAME_DATA });
    const target = await seedNode({ type: 'motion', x: 80, y: 520, data: FRAME_DATA });
    for (const [node, doc] of [[source, button], [target, blank]] as const) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const to = page.locator(`[data-testid="frame-overlays"] [data-frame="${target.id}"]`);
    await expect(to).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const row = await openComponents(page);
    await page.screenshot({ path: `${SHOTS}/comp-drop-1-panel.png` });
    const drop = (await to.boundingBox())!;
    await dropAt(page, row, { x: drop.x + drop.width / 2, y: drop.y + drop.height / 2 });
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/comp-drop-2-in-frame.png` });

    const instancesIn = async (nodeId: string) => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
      const head = data?.[0]?.doc as Head | undefined;
      return head?.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Precomp').length ?? 0;
    };
    await expect.poll(() => instancesIn(target.id), { timeout: 20_000 }).toBe(1);

    const empty = { x: drop.x + drop.width + 300, y: drop.y + drop.height / 2 };
    await dropAt(page, row, empty);
    const freeNodes = async () => {
      const { data } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null).not('id', 'in', `(${source.id},${target.id})`);
      const counts = await Promise.all((data ?? []).map((r) => instancesIn(r.id)));
      return counts.filter((c) => c === 1).length;
    };
    await expect.poll(freeNodes, { timeout: 20_000 }).toBe(1);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/comp-drop-3-free.png` });
  });
});
