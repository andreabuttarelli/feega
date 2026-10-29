import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent } from '../../src/lib/motion/main-component';
import { homed, placeInstance } from '../../src/lib/motion/canvas-components';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/editor-modes`;
const SETTLE_MS = 2500;
const FRAME_DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `e2e${++n}`;
const button = must(createComponent(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy now', size: 0.12, x: 0.5, y: 0.5, width: 0.6, height: 0.25 } }, 'label')), ['label'], newId, 'Button'));
const compId = String(button.tracks[0].clips[0].props.comp);

test.describe('go to main component @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('an instance on another canvas leads back to its main', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const home = await seedNode({ type: 'motion', x: 80, y: 80, data: FRAME_DATA });
    const otherCanvas = randomUUID();
    const { error: canvasError } = await admin.from('canvases').insert({ id: otherCanvas, org_id: session.orgId, project_id: session.projectId, name: 'Checkout' });
    expect(canvasError).toBeNull();
    const away = randomUUID();
    const { error: nodeError } = await admin.from('nodes').insert({ id: away, org_id: session.orgId, project_id: session.projectId, canvas_id: otherCanvas, type: 'motion', x: 80, y: 80, data: FRAME_DATA, actor_kind: 'user', actor_id: session.userId });
    expect(nodeError).toBeNull();
    const carried = must(placeInstance(newMotionDoc(MotionFormat.Landscape), homed(button, home.id), compId, newId));
    for (const [nodeId, doc] of [[home.id, button], [away, carried]] as const) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: nodeId, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${otherCanvas}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${away}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/go-main-1-instance.png` });
    const go = page.getByTestId('instance-go-main');
    await expect(go).toBeVisible({ timeout: 15_000 });
    await expect(go).toHaveAttribute('title', new RegExp(`${session.canvasName} › `));

    await go.click();
    await expect(page).toHaveURL(new RegExp(`/c/${session.canvasId}`), { timeout: 20_000 });
    await expect(page.locator(`[data-testid="frame-overlays"] [data-frame="${home.id}"]`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('instance-inspector')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/go-main-2-main.png` });
  });
});
