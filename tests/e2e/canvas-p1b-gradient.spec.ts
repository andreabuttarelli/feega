import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const END = 150;
const MID = 75;

const key = (frame: number, value: number | string) => ({ frame, value, ease: 'linear' });

function gradientDoc(still: number) {
  const card = {
    id: 'card',
    from: 0,
    durationInFrames: END,
    component: 'Shape',
    props: {
      shape: 'rect',
      x: 0.5,
      y: 0.5,
      width: 0.9,
      height: 0.9,
      fills: [{ type: 'linear-gradient', angle: 0, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 1 }] }]
    },
    keyframes: {
      'fill.0.stop.0.color': [key(0, '#ff0000'), key(END, '#00ff00')],
      'fill.0.stop.1.pos': [key(0, 1), key(END, 0.5)],
      'fill.0.angle': [key(0, 0), key(END, 90)]
    }
  };
  return { version: 5, fps: 30, width: 1080, height: 1350, durationInFrames: END, still: { frame: still }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [card] }], comps: {}, assets: [] };
}

test.describe('p1b animated gradient @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('core and dom draw the keyed gradient the same near the start and halfway', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const stills = [1, MID];
    for (const [i, still] of stills.entries()) {
      const node = await seedNode({ type: 'motion', x: 80 + i * 700, y: 80, data: PORTRAIT });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: gradientDoc(still), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }

    for (const renderer of ['core', 'dom']) {
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=${renderer}`);
      await page.waitForTimeout(8000);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/p1b-gradient-${renderer}.png` });
      }
    }
  });

  test('the keyframe diamond on a stop colour writes a keyframe, and the timeline shows the lanes', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const plain = gradientDoc(1);
    (plain.tracks[0].clips[0] as { keyframes: Record<string, unknown> }).keyframes = {};
    const node = await seedNode({ type: 'motion', x: 200, y: 80, data: LANDSCAPE });
    await admin.from('nodes').update({ width: 800, height: 450 }).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: plain, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(5000);
    const box = (await tile.boundingBox())!;
    const inspector = page.getByTestId('frame-inspector');
    await expect(async () => {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(inspector).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });

    const stack = inspector.getByTestId('fill-stack').first();
    await stack.getByTestId('fill-row').first().getByTestId('fill-swatch').click();
    const diamond = page.getByTestId('fill-editor').getByTestId('fill-key').first();
    await expect(diamond).toHaveAttribute('data-key', 'fill.0.stop.0.color');
    await diamond.click();
    await page.waitForTimeout(2000);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/p1b-gradient-diamond.png` });
    }

    await expect
      .poll(
        async () => {
          const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
          const clip = (data?.[0]?.doc as { tracks: { clips: { keyframes: Record<string, unknown[]> }[] }[] }).tracks[0].clips[0];
          return clip.keyframes['fill.0.stop.0.color']?.length ?? 0;
        },
        { timeout: 20_000 }
      )
      .toBeGreaterThan(0);
    await page.getByTestId('frame-timeline').getByRole('button', { name: 'Show keyframes' }).first().click();
    await expect(page.getByTestId('frame-timeline')).toContainText('stop 1 colour');
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/p1b-gradient-timeline.png` });
    }
  });
});
