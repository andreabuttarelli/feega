import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CANVAS_MOTION_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const NEW_ANGLE = 10;

const SUNSET = { kind: 'paint', fills: [{ type: 'linear-gradient', angle: 45, stops: [{ color: '#ff7a00', pos: 0 }, { color: '#7a00ff', pos: 1 }] }] };
const LIFTED = { kind: 'effect', effects: [{ id: 'sh', kind: 'drop-shadow', enabled: true, params: { distance: 30, angle: 90, blur: 40, opacity: 0.8 } }] };

const frame = (source: boolean) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: '#f2efe9',
  still: { frame: 0 },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        {
          id: 'card',
          component: 'Shape',
          from: 0,
          durationInFrames: 150,
          ...(source ? { styleRef: 'Sunset', effectStyleRef: 'Lifted', effects: LIFTED.effects } : {}),
          props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.5, height: 0.5, fills: source ? SUNSET.fills : [{ type: 'solid', color: '#888888' }] }
        }
      ]
    }
  ],
  comps: {},
  assets: [],
  ...(source ? { styles: { Sunset: SUNSET, Lifted: LIFTED } } : {})
});

type Card = { styleRef?: string; effectStyleRef?: string; effects: { params: { blur?: number } }[]; props: { fills: { type: string; angle?: number }[] } };

test.describe('effect and paint styles shared across frames @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('a gradient and a shadow style apply to another frame and editing them restyles both', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const data = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
    const a = await seedNode({ type: 'motion', x: 540, y: 80, data });
    const b = await seedNode({ type: 'motion', x: 80, y: 80, data });
    for (const [node, doc] of [
      [a, frame(true)],
      [b, frame(false)]
    ] as const) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }
    const head = async (nodeId: string) => {
      const { data: rows } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
      return (rows?.[0]?.doc as { tracks: { clips: Card[] }[] }).tracks[0].clips[0];
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const hostA = page.locator(`[data-testid="frame-overlays"] [data-frame="${a.id}"]`);
    const hostB = page.locator(`[data-testid="frame-overlays"] [data-frame="${b.id}"]`);
    await expect(hostB).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const selectCard = async (host: typeof hostA) => {
      const box = (await host.boundingBox())!;
      await page.mouse.click(box.x + 4, box.y + 4);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };

    await selectCard(hostB);
    const look = page.getByTestId('clip-style');
    await expect(look).toBeVisible({ timeout: 15_000 });
    await look.selectOption('Sunset');
    await page.getByTestId('clip-effect-style').selectOption('Lifted');
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/p1b-styles-1-applied.png` });
    await expect.poll(async () => (await head(b.id)).styleRef, { timeout: 20_000 }).toBe('Sunset');
    expect((await head(b.id)).effectStyleRef).toBe('Lifted');
    expect((await head(b.id)).props.fills[0].type).toBe('linear-gradient');
    expect((await head(b.id)).effects[0].params.blur).toBe(40);

    await selectCard(hostA);
    await expect(page.getByTestId('style-library')).toBeVisible({ timeout: 15_000 });
    const inspector = page.getByTestId('frame-inspector');
    await page.screenshot({ path: `${SHOTS}/p1b-styles-debug.png` });
    await inspector.getByTestId('fill-row').first().getByTestId('fill-swatch').click();
    const angle = page.getByTestId('fill-angle');
    await angle.fill(String(NEW_ANGLE));
    await angle.press('Enter');
    await inspector.locator('[data-testid="style-update"][data-style="Sunset"]').click();
    await page.waitForTimeout(SETTLE_MS * 2);
    await page.screenshot({ path: `${SHOTS}/p1b-styles-2-updated.png` });

    for (const node of [a, b]) {
      await expect.poll(async () => (await head(node.id)).props.fills[0].angle, { timeout: 20_000 }).toBe(NEW_ANGLE);
    }
  });
});
