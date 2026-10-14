import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const BRIEF = 'launch campaign for a sneaker brand: 3 social posters and a 10s motion teaser';
const CHAT_MODEL = 'anthropic/claude-sonnet-5.5';
const CHEAPEST_VIDEO = /Grok Imagine Video 1\.5 Lite/;
const POSTER = 'builtin:poster-type-grid';
const MOTION = 'builtin:split-headline';
const TURN_MS = 300_000;
const IMAGE_MS = 120_000;
const VIDEO_MS = 300_000;

const nodes = (page: Page) => page.locator('.svelte-flow__node');
const pane = (page: Page) => page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });

async function waitTurn(page: Page) {
  const stop = page.getByRole('button', { name: 'Stop generating' });
  await stop.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  await stop.waitFor({ state: 'hidden', timeout: TURN_MS });
}

async function ask(page: Page, text: string) {
  const box = page.getByPlaceholder('Ask the agent…').last();
  await box.fill(text);
  await box.press('Enter');
  await waitTurn(page);
}

async function generate(page: Page, kind: 'Image' | 'Video', prompt: string): Promise<Locator> {
  await pane(page);
  const before = await nodes(page).count();
  await page.getByRole('button', { name: kind, exact: true }).click();
  await expect(nodes(page)).toHaveCount(before + 1);
  const node = nodes(page).nth(before);
  if (kind === 'Video') {
    await page.getByRole('button', { name: 'Model' }).click();
    await page.getByText(CHEAPEST_VIDEO).first().click();
  }
  await node.getByRole('textbox').first().fill(prompt);
  await node.getByRole('button', { name: /^Generate/ }).click();
  await expect(node.locator(kind === 'Image' ? 'img' : 'video').first()).toBeVisible({ timeout: kind === 'Image' ? IMAGE_MS : VIDEO_MS });
  return node;
}

async function addTemplate(page: Page, tab: 'Stills' | 'Videos', id: string): Promise<string> {
  await pane(page);
  const before = await page.getByTestId('motion-node').count();
  await page.getByTestId('frame-templates').click();
  const library = page.getByTestId('component-library');
  await library.getByRole('tab', { name: tab, exact: true }).click();
  await library.locator(`[data-component="${id}"]`).click();
  await library.getByTestId('insert-component').click();
  await expect(page.getByTestId('motion-node')).toHaveCount(before + 1);
  return (await page.getByTestId('motion-node').nth(before).getAttribute('data-motion-node'))!;
}

async function openFrame(page: Page, id: string) {
  await page.locator(`[data-motion-node="${id}"]`).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
  await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
}

test.describe('the demo path @real', () => {
  test.skip(!REAL_STACK || !process.env.OPENROUTER_API_KEY, 'real stack and real models: E2E_REAL_STACK=1 and OPENROUTER_API_KEY');
  test.setTimeout(30 * 60_000);

  test('brief → canvas → generate → poster and motion frames → chat edits → export → share', async ({ page, session, admin, browser }) => {
    const latest = async (nodeId: string) => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
      return JSON.stringify(data?.[0]?.doc ?? {}).toLowerCase();
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('combobox', { name: 'Model' }).last().selectOption(CHAT_MODEL);
    await expect.poll(async () => (await (await page.request.get('/api/v1/chat-models')).json()).choice.model).toBe(CHAT_MODEL);

    await gotoHydrated(page, '/app');
    await page.getByTestId('video-brief').fill(BRIEF);
    await page.getByTestId('brief-send').click();
    await page.waitForURL(/\/p\/[^/]+\/c\/[^/?]+/);
    await expect(page.getByText(BRIEF).first()).toBeVisible();
    await waitTurn(page);

    await generate(page, 'Image', 'white sneaker floating on a bright orange background, studio product shot');
    await generate(page, 'Image', 'close-up of a sneaker sole splashing through a puddle, black and white');
    await generate(page, 'Video', 'a sneaker spinning slowly on a turntable, orange studio light');

    const poster = await addTemplate(page, 'Stills', POSTER);
    await expect(page.locator(`[data-motion-node="${poster}"] [data-testid=motion-node-poster]`), 'a new frame shows its picture').toBeVisible({ timeout: 30_000 });

    await page.getByTestId('drag-to-frame').first().dragTo(page.locator(`[data-motion-node="${poster}"]`));

    await openFrame(page, poster);
    const overlay = page.getByTestId('selection-overlay');
    const box = (await overlay.boundingBox())!;
    const title = { x: box.width * 0.3, y: box.height * 0.12 };
    await overlay.click({ position: title });
    await overlay.dblclick({ position: title });
    await page.getByTestId('part-edit').fill('AIR MAX');
    await page.getByTestId('part-edit').press('Enter');
    await expect.poll(() => latest(poster)).toContain('air max');

    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await page.getByRole('button', { name: 'Motion', exact: true }).click();

    await page.getByTestId('export-open').click();
    const png = page.waitForEvent('download');
    await page.getByTestId('still-export-go').click();
    expect((await png).suggestedFilename()).toMatch(/\.png$/);
    await page.keyboard.press('Escape');
    await page.getByTestId('inline-close').click();

    const motion = await addTemplate(page, 'Videos', MOTION);
    await openFrame(page, motion);
    await page.getByTestId('side-tab-chat').click();
    await ask(page, 'Change the headline of this frame to "run the city" and make the background deep orange #ff5a00');
    await expect.poll(() => latest(motion)).toContain('run the city');
    await ask(page, 'Add a small "new drop" label in the top left corner of this frame');
    await expect.poll(() => latest(motion)).toContain('new drop');

    await page.getByTestId('export-open').click();
    const mp4 = page.waitForEvent('download', { timeout: VIDEO_MS });
    await page.getByTestId('export-dialog').getByTestId('export-start').click();
    await page.getByTestId('export-download').first().click({ timeout: VIDEO_MS });
    expect((await mp4).suggestedFilename()).toMatch(/\.mp4$/);
    await page.keyboard.press('Escape');
    await page.getByTestId('inline-close').click();

    await ask(page, 'Create a new frame from the "Phone split" template with the headline "made to move"');
    await expect(page.getByTestId('motion-node')).toHaveCount(4);

    await page.getByRole('button', { name: 'Share' }).click();
    const share = page.getByRole('dialog', { name: 'Share' });
    await share.getByRole('checkbox').check();
    const link = await share.locator('input[readonly]').inputValue();

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const visitor = await browser.newContext({ viewport });
      const view = await visitor.newPage();
      await view.goto(link);
      await expect(view.locator('.svelte-flow__node').first()).toBeVisible({ timeout: 30_000 });
      await expect(view.getByPlaceholder('Ask the agent…'), 'a shared canvas is view-only').toHaveCount(0);
      await visitor.close();
    }
  });
});
