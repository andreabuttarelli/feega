import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const STEPS = [0.2, 0.4, 0.6, 0.8];
const OUT = process.env.FILL_POPOVER_OUT;
const STAGE = process.env.FILL_POPOVER_STAGE ?? 'run';

const box = {
  id: 'box',
  from: 0,
  durationInFrames: 150,
  component: 'Shape',
  props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.7, height: 0.6, fills: [{ type: 'solid', color: '#ff0000' }] }
};

const doc = {
  version: 5,
  fps: 30,
  width: 1080,
  height: 1350,
  durationInFrames: 150,
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [box] }],
  comps: {},
  assets: []
};

test.use({ launchOptions: { args: ['--enable-unsafe-webgpu'] } });

test.describe('the fill colour popover survives a drag @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('dragging the colour square keeps the popover open and the hex follows', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=gpu`);
    const stage = page.locator(`[data-id="${node.id}"]`).getByTestId('motion-node-stage');
    await expect(stage).toBeVisible({ timeout: 20_000 });
    const at = (await stage.boundingBox())!;
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await page.getByRole('tab', { name: 'Properties' }).click();
    await expect(page.getByTestId('motion-inspector').getByTestId('fill-stack').first()).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('motion-inspector').getByTestId('fill-stack').first().getByTestId('fill-row').first().getByTestId('fill-swatch').click();
    const popover = page.getByTestId('side-popover');
    const square = popover.getByTestId('colour-square');
    await expect(square).toBeVisible();
    const hex = popover.getByTestId('colour-channel');
    const before = await hex.inputValue();
    const area = (await square.boundingBox())!;

    await page.mouse.move(area.x + area.width * 0.9, area.y + area.height * 0.1);
    await page.mouse.down();
    for (const along of STEPS) {
      await page.mouse.move(area.x + area.width * along, area.y + area.height * along, { steps: 4 });
      await page.waitForTimeout(150);
      if (OUT && along === STEPS[0]) {
        await page.screenshot({ path: `${OUT}/${STAGE}-during.png` });
      }
      await expect(popover, 'the popover stays open while dragging').toBeVisible();
    }
    await page.mouse.up();
    await page.waitForTimeout(1000);
    if (OUT) {
      await page.screenshot({ path: `${OUT}/${STAGE}-after.png` });
    }

    await expect(popover, 'the popover stays open after release').toBeVisible();
    await expect(hex).not.toHaveValue(before);
  });
});
