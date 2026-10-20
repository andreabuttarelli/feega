import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CORE_TEXT_SHOTS ?? join(homedir(), 'Documents', 'feega-videos', 'shots', 'core-text-edit');
const FROM = { x: 300, y: 150 };
const DRAG = { width: 560, height: 380 };
const INPUT = '[data-testid="core-text-input"]';
const CARET = '[data-testid="core-caret"]';
const SELECTION = '[data-testid="core-selection"]';
const COMPOSITION = '[data-testid="core-composition"]';
const SETTLE_MS = 900;
const FIRST_EDIT_MS = 15_000;
const HIT_TOLERANCE_PX = 30;
const EDGE_PX = 12;
const COMPOSED_DRAFT = 'cafe';
const COMPOSED_FINAL = 'café';
const TARGET_SHARE = 0.8;

const shot = async (page: Page, name: string) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};

const textOf = (page: Page) => page.locator(INPUT).inputValue();

const caretAt = async (page: Page) => (await page.locator(CARET).boundingBox())!;

const selectionSpan = async (page: Page) => {
  const boxes = await page.locator(SELECTION).evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })));
  return { left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)), count: boxes.length };
};

test.describe('text edit in the core is drawn by the core @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('type, select, compose and undo with the caret drawn from core metrics', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=core`);
    await pickBarTool(page, 'text');
    await page.mouse.move(FROM.x, FROM.y);
    await page.mouse.down();
    await page.mouse.move(FROM.x + DRAG.width / 2, FROM.y + DRAG.height / 2);
    await page.mouse.move(FROM.x + DRAG.width, FROM.y + DRAG.height);
    await page.mouse.up();
    await page.waitForTimeout(1500);
    await shot(page, '01-created');

    const frame = (await page.getByTestId('selection-box').boundingBox())!;
    const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
    await page.mouse.click(centre.x, centre.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.dblclick(centre.x, centre.y);
    const input = page.locator(INPUT);
    await expect(input).toBeAttached({ timeout: FIRST_EDIT_MS });
    await shot(page, '02-editing');

    await page.keyboard.press('Meta+A');
    await page.keyboard.type('Hi');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('yo');
    await expect(page.locator(CARET)).toHaveCount(1, { timeout: FIRST_EDIT_MS });
    await page.waitForTimeout(SETTLE_MS);
    expect(await textOf(page)).toBe('Hi\nyo');
    await shot(page, '03-typed');

    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator(SELECTION)).toHaveCount(1);
    await shot(page, '04-shift-arrows');

    await page.keyboard.press('Alt+Shift+ArrowLeft');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, '05-alt-shift-word');

    await page.keyboard.press('Meta+ArrowUp');
    await page.keyboard.press('Home');
    const lineStart = await caretAt(page);
    await page.keyboard.press('End');
    const lineEnd = await caretAt(page);
    expect(lineEnd.x).toBeGreaterThan(lineStart.x + HIT_TOLERANCE_PX);
    const y = lineStart.y + lineStart.height / 2;
    await page.keyboard.type('!');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, '06-end-typed');

    const target = lineStart.x + (lineEnd.x - lineStart.x) * TARGET_SHARE;
    await page.mouse.click(target, y);
    await page.waitForTimeout(SETTLE_MS);
    expect(Math.abs((await caretAt(page)).x - target)).toBeLessThan(HIT_TOLERANCE_PX);
    await shot(page, '07-click-caret');

    await page.mouse.dblclick(target, y);
    await page.waitForTimeout(SETTLE_MS);
    const word = await selectionSpan(page);
    expect(word.count).toBeGreaterThan(0);
    expect(word.left).toBeLessThan(target);
    expect(word.right).toBeGreaterThan(target);
    await shot(page, '08-double-click-word');

    await page.mouse.click(target, y, { clickCount: 3, delay: 30 });
    await page.waitForTimeout(SETTLE_MS);
    const line = await selectionSpan(page);
    expect(line.right - line.left).toBeGreaterThanOrEqual(word.right - word.left - 1);
    await shot(page, '09-triple-click-line');

    await page.mouse.move(lineStart.x + EDGE_PX, y);
    await page.mouse.down();
    await page.mouse.move(target, y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);
    const dragged = await selectionSpan(page);
    expect(dragged.left).toBeLessThan(lineStart.x + 2 * HIT_TOLERANCE_PX);
    expect(Math.abs(dragged.right - target)).toBeLessThan(HIT_TOLERANCE_PX);
    await shot(page, '10-drag-select');

    await page.keyboard.press('End');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', { text: COMPOSED_DRAFT, selectionStart: COMPOSED_DRAFT.length, selectionEnd: COMPOSED_DRAFT.length });
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator(COMPOSITION)).toHaveCount(1);
    await shot(page, '11-composition');
    await cdp.send('Input.insertText', { text: COMPOSED_FINAL });
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator(COMPOSITION)).toHaveCount(0);
    expect(await textOf(page)).toContain(COMPOSED_FINAL);
    await shot(page, '12-composition-committed');

    const typed = await textOf(page);
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(SETTLE_MS);
    expect(await textOf(page)).not.toBe(typed);
    await shot(page, '13-undo');

    const before = await caretAt(page);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(SETTLE_MS);
    expect((await caretAt(page)).y).toBeGreaterThan(before.y);
    await shot(page, '14-arrow-down');

    await expect(input).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(input).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, '15-committed');
  });
});
