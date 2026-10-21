import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PHRASE = 'Ciao, come stai oggi amico mio';
const KEY_GAP_MS = 120;
const SETTLE_MS = 2500;
const STAGE_WIDTH_PX = 1920;
const FIT_SLACK_PX = 4;
const GLYPH_INSET_PX = { x: 15, y: 11 };
const SHOTS = process.env.CANVAS_TEXT_SHOTS ?? '/tmp';

const blank = {
  version: 5,
  fps: 30,
  width: STAGE_WIDTH_PX,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }],
  comps: {},
  assets: []
};

type Head = { tracks: { clips: { props: Record<string, number | string> }[] }[] };

test.describe('typing a text inside a frame @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('the text box ends as wide as the words', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: blank, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await host.boundingBox())!;
    await page.mouse.click(stage.x + 4, stage.y + 4);

    await pickBarTool(page, 'text');
    const at = { x: stage.x + stage.width * 0.1, y: stage.y + stage.height * 0.4 };
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(SETTLE_MS);
    const field = page.getByTestId('core-text-edit');
    await page.mouse.dblclick(at.x + GLYPH_INSET_PX.x, at.y + GLYPH_INSET_PX.y);
    await expect(field, 'a double-click opens the caret on the new text').toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(PHRASE, { delay: KEY_GAP_MS });
    const typed = (await field.evaluate((el) => el.getBoundingClientRect().width)) * (STAGE_WIDTH_PX / stage.width);
    await page.screenshot({ path: `${SHOTS}/frame-text-typing.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const clip = (data?.[0]?.doc as Head).tracks[0].clips[0];
    expect(clip.props.text).toBe(PHRASE);
    expect(Number(clip.props.width) * STAGE_WIDTH_PX).toBeGreaterThanOrEqual(typed - FIT_SLACK_PX * (STAGE_WIDTH_PX / stage.width));
  });
});
