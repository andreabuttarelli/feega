import type { Locator, Page } from '@playwright/test';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const COLOURS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
const LAST = COLOURS.at(-1)!;

type Clip = { component: string; props: { fills?: { color?: string }[]; fill?: string } };
type Doc = { tracks: { clips: Clip[] }[] };

async function headDoc(admin: SupabaseClient, nodeId: string): Promise<Doc | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as Doc | undefined) ?? null;
}

const boxColour = (doc: Doc | null) => doc?.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Shape')?.props.fills?.[0]?.color ?? null;

async function drawBox(page: Page, tool = 'rectangle') {
  await page.getByTestId('add-bar').getByTestId('draw-tools').locator(`[data-tool="${tool}"]`).click();
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y + 60);
  await page.mouse.move(from.x + 240, from.y + 120);
  await page.mouse.up();
}

async function markEditor(page: Page) {
  await page.getByTestId('motion-editor').evaluate((el) => {
    (el as HTMLElement & { __kept?: boolean }).__kept = true;
  });
}

async function editorKept(page: Page): Promise<boolean> {
  return page.getByTestId('motion-editor').evaluate((el) => !!(el as HTMLElement & { __kept?: boolean }).__kept);
}

const fillHex = (page: Page) => page.getByTestId('fill-editor').locator('input.hex').first();

async function openFill(page: Page) {
  if (await fillHex(page).isVisible()) {
    return;
  }
  await page.getByTestId('motion-inspector').getByTestId('fill-stack').first().getByTestId('fill-swatch').first().click();
}

const emptyCanvasPoint = (page: Page) =>
  page.evaluate(() => {
    for (let y = 60; y < innerHeight; y += 20) {
      for (let x = 80; x < innerWidth; x += 20) {
        if (document.elementFromPoint(x, y)?.classList.contains('svelte-flow__pane')) {
          return { x, y };
        }
      }
    }
    return null;
  });

const PROMPT_PLACEHOLDER = 'What should it be about…';
const WORD = 'lorem ipsum ';
const KEY_DELAY_MS = 25;
const TYPING_MS = 10_000;
const RED = '#ff0000';
const RED_SHARE = 0.3;

async function reddest(tile: Locator): Promise<number> {
  const { data, info } = await sharp(await tile.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let red = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] < 80 && data[i + 2] < 80) {
      red += 1;
    }
  }
  return red / (info.width * info.height);
}

const WATCH_SAMPLES = 12;
const WATCH_EVERY_MS = 500;

async function stillRed(page: Page, tile: Locator) {
  for (let i = 0; i < WATCH_SAMPLES; i++) {
    expect(await reddest(tile), `the tile went back to another colour after ${i * WATCH_EVERY_MS} ms`).toBeGreaterThan(RED_SHARE);
    await page.waitForTimeout(WATCH_EVERY_MS);
  }
}

const SERVER_LAG_MS = 700;

async function slowServer(page: Page) {
  await page.route(/\?\/|\/session$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SERVER_LAG_MS));
    await route.continue();
  });
}

test.describe('edits are never lost @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('five quick colour changes on a free box stay, with the editor never remounted', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    let loads = 0;
    page.on('request', (req) => {
      if (req.url().endsWith('/session')) {
        loads += 1;
      }
    });
    await slowServer(page);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await drawBox(page);
    const element = page.locator('[data-kind="element"][data-motion-node]');
    await expect(element).toHaveCount(1, { timeout: 15_000 });
    const nodeId = (await element.getAttribute('data-motion-node'))!;
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
    await openFill(page);
    await expect(fillHex(page)).toBeVisible({ timeout: 15_000 });
    await markEditor(page);
    const loadsBefore = loads;

    for (const colour of COLOURS) {
      await fillHex(page).fill(colour);
      await fillHex(page).press('Enter');
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(8_000);
    expect(await editorKept(page), 'the editor was remounted').toBe(true);
    expect(loads - loadsBefore, 'the editor reloaded its session').toBe(0);
    await expect(page.getByTestId('inline-motion-loading')).toHaveCount(0);
    await expect(fillHex(page)).toHaveValue(new RegExp(LAST.slice(1), 'i'));
    await expect.poll(async () => boxColour(await headDoc(admin, nodeId))?.toLowerCase(), { timeout: 10_000 }).toBe(LAST);

    await page.reload();
    await expect(page.locator(`[data-motion-node="${nodeId}"]`)).toBeVisible({ timeout: 15_000 });
    await page.locator(`[data-motion-node="${nodeId}"]`).click();
    await openFill(page);
    await expect(fillHex(page)).toHaveValue(new RegExp(LAST.slice(1), 'i'), { timeout: 15_000 });
  });

  test('a box closed and reopened right after an edit shows it, and keeps saving', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await slowServer(page);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await drawBox(page);
    const element = page.locator('[data-kind="element"][data-motion-node]');
    await expect(element).toHaveCount(1, { timeout: 15_000 });
    const nodeId = (await element.getAttribute('data-motion-node'))!;
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });

    for (const colour of COLOURS.slice(0, 3)) {
      await openFill(page);
      await fillHex(page).fill(colour);
      await fillHex(page).press('Enter');
      await expect.poll(async () => boxColour(await headDoc(admin, nodeId))?.toLowerCase(), { timeout: 10_000 }).toBe(colour);
      const empty = (await emptyCanvasPoint(page))!;
      await page.mouse.click(empty.x, empty.y);
      await expect(page.getByTestId('motion-editor')).toHaveCount(0);
      await page.locator(`[data-motion-node="${nodeId}"]`).click();
      await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
      await openFill(page);
      await expect(fillHex(page), 'the reopened editor shows the last colour').toHaveValue(new RegExp(colour.slice(1), 'i'));
      await expect.poll(async () => boxColour(await headDoc(admin, nodeId))?.toLowerCase(), { timeout: 10_000 }).toBe(colour);
    }
  });

  test('a generative prompt typed for ten seconds on a slow server keeps every key, and the database the last one', async ({ page, session, seedNode, admin }) => {
    test.setTimeout(120_000);
    const typed = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: '' } });
    await slowServer(page);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const node = page.locator(`.svelte-flow__node[data-id="${typed.id}"]`);
    const prompt = node.getByPlaceholder(PROMPT_PLACEHOLDER);
    await node.click();
    await prompt.click();

    let expected = '';
    const until = Date.now() + TYPING_MS;
    while (Date.now() < until) {
      await prompt.pressSequentially(WORD, { delay: KEY_DELAY_MS });
      expected += WORD;
      await expect(prompt).toHaveValue(expected);
    }

    await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'saved', { timeout: 15_000 });
    await expect(prompt).toHaveValue(expected);
    await expect.poll(async () => (await admin.from('nodes').select('data').eq('id', typed.id).single()).data?.data?.prompt, { timeout: 10_000 }).toBe(expected);
    await page.reload();
    await expect(page.locator(`.svelte-flow__node[data-id="${typed.id}"]`).getByPlaceholder(PROMPT_PLACEHOLDER)).toHaveValue(expected, { timeout: 15_000 });
  });

  test('two tabs: tab A edits reach tab B without reverting what B is typing', async ({ page, session, seedNode }) => {
    test.setTimeout(120_000);
    const mine = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: '' } });
    const theirs = await seedNode({ type: 'text', x: 700, y: 0, data: { prompt: '' } });
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const other = await page.context().newPage();
    await slowServer(page);
    await slowServer(other);
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);
    const promptIn = (tab: Page, id: string) => tab.locator(`.svelte-flow__node[data-id="${id}"]`).getByPlaceholder(PROMPT_PLACEHOLDER);

    await other.locator(`.svelte-flow__node[data-id="${theirs.id}"]`).click();
    await promptIn(other, theirs.id).click();
    await page.locator(`.svelte-flow__node[data-id="${mine.id}"]`).click();
    await promptIn(page, mine.id).click();

    const sentence = WORD.repeat(6);
    await Promise.all([promptIn(page, mine.id).pressSequentially(sentence, { delay: KEY_DELAY_MS }), promptIn(other, theirs.id).pressSequentially(sentence, { delay: KEY_DELAY_MS })]);

    await expect(promptIn(other, mine.id)).toHaveValue(sentence, { timeout: 15_000 });
    await expect(promptIn(page, theirs.id)).toHaveValue(sentence, { timeout: 15_000 });
    await expect(promptIn(other, theirs.id)).toHaveValue(sentence);
    await expect(promptIn(page, mine.id)).toHaveValue(sentence);
  });

  for (const tool of ['rectangle', 'ellipse']) {
    test(`a ${tool} filled red stays red on its tile once deselected, and after a reload`, async ({ page, session, admin }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await drawBox(page, tool);
      const element = page.locator('[data-kind="element"][data-motion-node]');
      await expect(element).toHaveCount(1, { timeout: 15_000 });
      const nodeId = (await element.getAttribute('data-motion-node'))!;
      await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
      await openFill(page);
      await fillHex(page).fill(RED);
      await fillHex(page).press('Enter');
      await expect.poll(async () => boxColour(await headDoc(admin, nodeId))?.toLowerCase(), { timeout: 10_000 }).toBe(RED);

      const empty = (await emptyCanvasPoint(page))!;
      await page.mouse.click(empty.x, empty.y);
      await expect(page.getByTestId('motion-editor')).toHaveCount(0);
      const tile = page.locator(`[data-motion-node="${nodeId}"]`);
      await expect(tile.getByText('Frame', { exact: true }), 'an element has no frame chrome').toHaveCount(0);
      await expect(tile.locator('[data-drawn="true"], [data-testid=motion-node-poster]').first()).toBeVisible({ timeout: 15_000 });
      await stillRed(page, tile);

      await page.reload();
      await expect(tile).toBeVisible({ timeout: 15_000 });
      await expect(tile.getByText('Frame', { exact: true })).toHaveCount(0);
      await expect(tile.locator('[data-drawn="true"], [data-testid=motion-node-poster]').first()).toBeVisible({ timeout: 15_000 });
      await stillRed(page, tile);
    });
  }
});
