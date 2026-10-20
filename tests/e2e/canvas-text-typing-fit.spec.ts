import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PHRASE = 'Ciao, come stai oggi amico mio';
const KEY_GAP_MS = 120;
const SETTLE_MS = 2500;
const FIT_SLACK_PX = 12;

test.describe('typing a free text @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('the box ends as wide as the words, not narrower, and stays there', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await pickBarTool(page, 'text');
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    await page.mouse.click(pane.x + pane.width * 0.3, pane.y + pane.height * 0.35);
    const field = page.frameLocator('[data-testid="motion-preview"] iframe').first().locator('[contenteditable]');
    await expect(field).toHaveAttribute('contenteditable', /plaintext-only|true/, { timeout: 15_000 });

    const node = () => admin.from('nodes').select('width').eq('canvas_id', session.canvasId).is('deleted_at', null).single();
    const { data: before } = await node();
    await page.keyboard.type(PHRASE, { delay: KEY_GAP_MS });
    const typed = await field.evaluate((el) => ({ words: el.getBoundingClientRect().width, stage: el.ownerDocument.getElementById('root')!.offsetWidth }));
    const wordsInNode = (typed.words * Number(before!.width)) / typed.stage;

    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    const { data: settled } = await node();
    await page.waitForTimeout(SETTLE_MS);
    const { data: later } = await node();

    expect(Number(settled!.width), 'the words fit in the node').toBeGreaterThanOrEqual(wordsInNode - FIT_SLACK_PX);
    expect(Math.abs(Number(later!.width) - Number(settled!.width)), 'the node stays where it settled').toBeLessThanOrEqual(FIT_SLACK_PX);
  });
});
