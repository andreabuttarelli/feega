import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.STATES_SHOTS ?? 'test-results/states';
const SETTLE_MS = 2500;
const HOVER_MS = 900;

const fill = (color: string) => [{ type: 'solid', color, opacity: 1, visible: true, blend: 'normal' }];

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        { id: 'card', name: 'Plan card', component: 'Shape', from: 0, durationInFrames: 150, props: { shape: 'rect', x: 0.27, y: 0.5, width: 0.3, height: 0.5, cornerRadius: 24, fills: fill('#1c1c24') } },
        {
          id: 'cta',
          name: 'Get started',
          component: 'Shape',
          from: 0,
          durationInFrames: 150,
          props: { shape: 'rect', x: 0.7, y: 0.5, width: 0.3, height: 0.14, cornerRadius: 16, fills: fill('#2b5cff') },
          states: [
            { state: 'hover', overrides: { opacity: 0.85, fill: '#5b82ff', scale: 1.06 }, transition: { easing: 'enter', durationMs: 320 } },
            { state: 'pressed', overrides: { scale: 0.96 }, transition: { easing: 'standard', durationMs: 90 } }
          ]
        }
      ]
    }
  ],
  comps: {},
  assets: []
};

test.describe('element states and the variant plus @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('preview a state, edit its curve, add a variant, hover in the player', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);

    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.5);
    const states = page.getByTestId('states-section');
    await expect(states).toBeVisible({ timeout: 15_000 });
    await states.scrollIntoViewIfNeeded();
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/2a-state-switcher-default.png` });
    await states.locator('[data-state="hover"]').click();
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/2-state-switcher-hover.png` });

    await states.getByRole('button', { name: 'Edit the curve' }).click();
    await expect(page.getByTestId('state-curve-picker')).toBeAttached();
    await page.getByTestId('state-curve-picker').scrollIntoViewIfNeeded();
    await states.screenshot({ path: `${SHOTS}/3-states-panel-curve.png` });
    await page.screenshot({ path: `${SHOTS}/3b-states-panel-curve-full.png` });
    await states.locator('[data-state="default"]').click();

    await page.mouse.click(box.x + box.width * 0.27, box.y + box.height * 0.5);
    await expect(page.getByTestId('frame-selection').first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Alt+Meta+k');
    await expect(page.getByTestId('instance-inspector')).toBeVisible({ timeout: 15_000 });
    const plus = page.getByTestId('variant-plus');
    await expect(plus).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/1-variant-plus.png` });
    await plus.click();
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/1b-variant-added.png` });

    await page.getByRole('group', { name: 'Editor mode' }).getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByTestId('prototype-play')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('prototype-play').click();
    const player = page.getByTestId('prototype-player');
    await expect(player).toBeVisible({ timeout: 15_000 });
    const spot = player.getByTestId('state-spot').first();
    await expect(spot).toBeVisible({ timeout: 15_000 });
    const target = (await spot.boundingBox())!;
    await page.mouse.move(target.x - 120, target.y - 60);
    await page.waitForTimeout(HOVER_MS);
    for (let round = 0; round < 2; round++) {
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
      await page.waitForTimeout(HOVER_MS);
      await page.mouse.down();
      await page.waitForTimeout(HOVER_MS / 2);
      await page.mouse.up();
      await page.waitForTimeout(HOVER_MS / 2);
      await page.mouse.move(target.x - 120, target.y - 60, { steps: 12 });
      await page.waitForTimeout(HOVER_MS);
    }
    await page.screenshot({ path: `${SHOTS}/4-player.png` });
  });
});
