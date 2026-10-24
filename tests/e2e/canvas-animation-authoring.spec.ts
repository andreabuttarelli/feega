import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SETTLE_MS = 2500;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const key = (frame: number, value: number) => ({ frame, value, ease: 'linear' });
const shape = (id: string, over: object = {}) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, fills: [{ type: 'solid', color: '#1f5aff' }] }, ...over });
const docOf = (clips: object[]) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: clips.map((clip, i) => ({ id: `t${i}`, kind: 'visual', name: `Video ${i + 1}`, clips: [clip] })),
  comps: {},
  assets: []
});

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_PREFIX.replace(/shot$/, 'r7')}-${name}.png` });
}

type Seeded = { nodeId: string; frame: ReturnType<Page['locator']> };

test.describe('animation authoring on the canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  async function open(page: Page, session: { orgId: string; userId: string; projectId: string; canvasId: string }, admin: any, seedNode: any, doc: object): Promise<Seeded> {
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    return { nodeId: node.id, frame: page.locator(`[data-frame="${node.id}"]`) };
  }

  const headDoc = async (admin: any, nodeId: string) => (await admin.from('motion_revisions').select('doc, version').eq('node_id', nodeId).order('version', { ascending: false }).limit(1).single()).data.doc;
  const clipIn = (doc: any, id: string) => doc.tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === id);

  async function enter(page: Page, seeded: Seeded) {
    const r = (await seeded.frame.boundingBox())!;
    const at = { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(at.x, at.y);
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });
  }

  test('Design moves the whole animation, Animate keys the playhead', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const slide = shape('slide', { keyframes: { x: [key(0, 0.3), key(149, 0.6)] } });
    const seeded = await open(page, session, admin, seedNode, docOf([slide]));
    await enter(page, seeded);
    await page.locator('[data-layer="slide"] .head').click();
    const ruler = page.getByRole('slider', { name: 'Playhead' });
    const rect = (await ruler.boundingBox())!;
    await page.mouse.click(rect.x + rect.width * 0.5, rect.y + rect.height / 2);
    const playhead = Number(await ruler.getAttribute('aria-valuenow'));
    expect(playhead).toBeGreaterThan(1);
    expect(playhead).toBeLessThan(148);

    const mode = page.getByTestId('frame-timeline-mode');
    await expect(mode).toHaveAttribute('data-mode', 'design');
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => clipIn(await headDoc(admin, seeded.nodeId), 'slide').keyframes.x[0].value, { timeout: 15_000 }).toBeGreaterThan(0.3);
    const designed = clipIn(await headDoc(admin, seeded.nodeId), 'slide').keyframes.x;
    expect(designed).toHaveLength(2);
    expect(designed[1].value - 0.6).toBeCloseTo(designed[0].value - 0.3, 5);
    await shot(page, 'mode-design');

    await mode.click();
    await expect(mode).toHaveAttribute('data-mode', 'motion');
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => clipIn(await headDoc(admin, seeded.nodeId), 'slide').keyframes.x.length, { timeout: 15_000 }).toBe(3);
    await shot(page, 'mode-animate');

    await page.keyboard.press('e');
    await expect(mode).toHaveAttribute('data-mode', 'design');
  });

  test('a key dragged near another key snaps onto it and shows the guide', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const mover = shape('mover', { keyframes: { x: [key(10, 0.3), key(100, 0.6)] } });
    const anchor = shape('anchor', { keyframes: { y: [key(40, 0.4), key(120, 0.6)] } });
    const seeded = await open(page, session, admin, seedNode, docOf([mover, anchor]));
    await enter(page, seeded);

    const keyAt = (clip: string, frame: number) => page.locator(`[data-key-clip="${clip}"][data-key-frame="${frame}"]`);
    await page.locator('[data-layer="mover"] .twirl').click();
    await page.locator('[data-layer="anchor"] .twirl').click();
    await expect(keyAt('mover', 10)).toBeVisible({ timeout: 15_000 });
    await expect(keyAt('anchor', 40)).toBeVisible();
    const from = (await keyAt('mover', 10).boundingBox())!;
    const target = (await keyAt('anchor', 40).boundingBox())!;
    const y = from.y + from.height / 2;

    await page.mouse.move(from.x + from.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2 - 20, y, { steps: 8 });
    await page.mouse.move(target.x + target.width / 2 + 6, y, { steps: 4 });
    await expect(page.getByTestId('snap-guide')).toBeVisible();
    await shot(page, 'snap-key');
    await page.mouse.up();

    await expect.poll(async () => clipIn(await headDoc(admin, seeded.nodeId), 'mover').keyframes.x.map((k: any) => k.frame), { timeout: 15_000 }).toContain(40);
  });

  test('Convert to keys replaces an expression with keyframes', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const spin = shape('spin', { expressions: { rotateZ: 'time * 90' } });
    const seeded = await open(page, session, admin, seedNode, docOf([spin]));
    await enter(page, seeded);

    const convert = page.getByTestId('expression-to-keys-rotateZ');
    await expect(convert).toBeVisible({ timeout: 15_000 });
    await shot(page, 'expression-before');
    await convert.click();

    await expect.poll(async () => Object.keys(clipIn(await headDoc(admin, seeded.nodeId), 'spin').expressions ?? {}), { timeout: 15_000 }).toEqual([]);
    expect(clipIn(await headDoc(admin, seeded.nodeId), 'spin').keyframes.rotateZ.length).toBeGreaterThanOrEqual(2);
    await expect(convert).toHaveCount(0);
    await shot(page, 'expression-after');
  });

  test('Group on two selected segments makes one group segment', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const a = shape('a', { props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.2, fills: [{ type: 'solid', color: '#ff5a1f' }] } });
    const b = shape('b', { from: 30, durationInFrames: 90, props: { shape: 'rect', x: 0.7, y: 0.5, width: 0.2, height: 0.2, fills: [{ type: 'solid', color: '#1fae5a' }] } });
    const seeded = await open(page, session, admin, seedNode, docOf([a, b]));
    await enter(page, seeded);

    await page.locator('[data-layer="a"] .head').click();
    await page.locator('[data-layer="b"] .head').click({ modifiers: ['Shift'] });
    const group = page.getByTestId('frame-timeline-group');
    await expect(group).toBeVisible({ timeout: 15_000 });
    await shot(page, 'group-before');
    await group.click();

    await expect
      .poll(async () => (await headDoc(admin, seeded.nodeId)).tracks.flatMap((t: any) => t.clips).map((c: any) => c.component), { timeout: 15_000 })
      .toEqual(['Precomp']);
    await shot(page, 'group-after');
  });
});
