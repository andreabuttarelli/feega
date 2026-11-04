import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.SHAPE_SHOTS ?? '/tmp';
const SETTLE_MS = 2500;
const RED = '#b0413e';
const LAYOUT = { direction: 'horizontal', wrap: false, gap: 40, crossGap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, justify: 'center', align: 'center', columns: 2, order: [] };
const ARC_OWNERS = ['ellipse', 'disc'];

const clip = (id: string, component: string, props: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id,
  from: 0,
  durationInFrames: 150,
  component,
  ...extra,
  props
});

const shape = (id: string, kind: string, x: number, y: number, props: Record<string, unknown> = {}) =>
  clip(id, 'Shape', { shape: kind, x, y, width: 0.16, height: 0.2, fills: [{ type: 'solid', color: '#0a84ff' }], ...props });

const frameDoc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        shape('rect', 'rect', 0.1, 0.2),
        shape('ellipse', 'ellipse', 0.3, 0.2),
        shape('polygon', 'polygon', 0.5, 0.2, { sides: 5 }),
        shape('star', 'star', 0.7, 0.2),
        shape('disc', 'ellipse', 0.2, 0.7, { width: 0.2, height: 0.3, fills: [{ type: 'solid', color: RED }] }),
        shape('stacked-disc', 'ellipse', 0.7, 0.7, { width: 0.3, height: 0.3, fills: [{ type: 'solid', color: RED }] }),
        clip('row', 'Shape', { shape: 'rect', x: 0.7, y: 0.7, width: 0.3, height: 0.3, fills: [] }, { autoLayout: LAYOUT }),
        ...['a', 'b', 'c'].map((n) => clip(`ciao-${n}`, 'Text', { text: 'Ciao', size: 0.04, x: 0.5, y: 0.5, width: 0.1, height: 0.05, color: '#ffffff' }, { parent: 'row' }))
      ]
    }
  ],
  comps: {},
  assets: []
};

test.describe('shape kind is chosen at creation @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('the panel never offers a Shape switcher and shows the arc fields only for an ellipse', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: frameDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=dom`);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/loaded.png` });
    const box = (await page.locator(`[data-frame="${frame.id}"]`).first().boundingBox())!;
    const at = (x: number, y: number) => ({ x: box.x + box.width * x, y: box.y + box.height * y });
    const first = at(0.1, 0.2);
    await page.mouse.click(first.x, first.y);
    await page.waitForTimeout(SETTLE_MS);

    const picks = [['rect', 0.1, 0.2], ['ellipse', 0.3, 0.2], ['polygon', 0.5, 0.2], ['star', 0.7, 0.2], ['disc', 0.2, 0.7], ['row', 0.7, 0.76]] as const;
    for (const [id, x, y] of picks) {
      const p = at(x, y);
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(800);
      await expect(page.locator('#f-shape')).toHaveCount(0);
      await expect(page.getByText('Sweep', { exact: true })).toHaveCount(ARC_OWNERS.includes(id) ? 1 : 0);
      await page.screenshot({ path: `${SHOTS}/${id}.png` });
    }
  });
});
