import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CANVAS_P2B_SHOTS ?? '/tmp';
const SETTLE_MS = 2500;
const TOKEN = 'brand.accent';
const SWAPPED = 'brand.secondary';

const text = (id: string, x: number) => ({ id, from: 0, durationInFrames: 150, component: 'Text', props: { text: id, size: 0.12, x, y: 0.5, width: 0.3, height: 0.25, color: TOKEN, fills: [{ type: 'solid', color: TOKEN }] } });

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [text('one', 0.25), text('two', 0.7)] }],
  comps: {},
  assets: []
};

type Head = { tracks: { clips: { id: string; props: { color?: string } }[] }[] };

test.describe('selection colours with brand tokens @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('a brand token is listed and swapped for another token, staying a token', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`).boundingBox())!;
    await page.mouse.click(stage.x + 4, stage.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(stage.x + stage.width * 0.25, stage.y + stage.height / 2);
    await page.waitForTimeout(800);
    await page.keyboard.press('Meta+a');

    await page.screenshot({ path: `${SHOTS}/p2b-colours-0-selected.png` });
    const row = page.locator(`[data-section="colours"] [data-colour="${TOKEN}"]`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/p2b-colours-1-token.png` });
    await row.getByTestId('token-swap').selectOption(SWAPPED);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/p2b-colours-2-swapped.png` });

    const colours = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
      return (data?.[0]?.doc as Head).tracks[0].clips.map((c) => c.props.color);
    };
    await expect.poll(colours, { timeout: 15_000 }).toEqual([SWAPPED, SWAPPED]);
  });
});
