import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const KEY_GAP_MS = 40;
const SETTLE_MS = 3000;
const AT = { x: 1100, y: 150 };

type Head = { tracks: { clips: { props: { text?: string } }[] }[] };

test.describe('typing on a new and an existing text @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('the first key survives and End appends instead of replacing', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);

    await pickBarTool(page, 'text');
    await page.mouse.click(AT.x, AT.y);
    await page.keyboard.type('Title', { delay: KEY_GAP_MS });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);

    const textOf = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('org_id', session.orgId).order('created_at', { ascending: false }).limit(1);
      return (data?.[0]?.doc as Head).tracks.flatMap((t) => t.clips).map((c) => c.props.text).join('|');
    };
    expect(await textOf()).toBe('Title');

    const host = page.locator('[data-testid="frame-overlays"] [data-frame]').first();
    const box = (await host.boundingBox())!;
    await page.keyboard.press('Escape');
    await pickBarTool(page, 'select');
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('core-text-edit')).toBeFocused({ timeout: 15_000 });
    await page.keyboard.press('End');
    await page.keyboard.type(' one', { delay: KEY_GAP_MS });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);

    expect(await textOf()).toBe('Title one');
  });
});
