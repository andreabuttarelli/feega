import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const TYPING_MS = 5_000;
const OFFLINE_MS = 10_000;
const KEY_DELAY_MS = 25;
const LOADING_SELECTORS = '[aria-busy="true"], .is-spinning';
const UNREACHABLE_STORE = 'https://store.example.invalid';

type Row = { data: Record<string, unknown>; version: number; display_name: string | null };

async function nodeRow(admin: SupabaseClient, id: string): Promise<Row> {
  return (await admin.from('nodes').select('data, version, display_name').eq('id', id).single()).data as Row;
}

const canvasPath = (session: { projectId: string; canvasId: string }) => `/p/${session.projectId}/c/${session.canvasId}`;

async function mark(field: Locator) {
  await field.evaluate((el) => { (el as HTMLElement & { __kept?: boolean }).__kept = true; });
}

async function stillMounted(field: Locator): Promise<boolean> {
  return field.evaluate((el) => Boolean((el as HTMLElement & { __kept?: boolean }).__kept) && el.isConnected);
}

async function forceResync(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function typeFor(page: Page, field: Locator, tile: Locator, ms: number, midway: () => Promise<void>): Promise<string> {
  await field.click();
  let typed = (await field.inputValue()) ?? '';
  const until = Date.now() + ms;
  let interrupted = false;
  while (Date.now() < until) {
    await field.pressSequentially('ab', { delay: KEY_DELAY_MS });
    typed += 'ab';
    if (!interrupted && Date.now() > until - ms / 2) {
      interrupted = true;
      await midway();
      await forceResync(page);
    }
    await expect(tile.locator(LOADING_SELECTORS)).toHaveCount(0);
    await expect(field).toHaveValue(typed);
  }
  return typed;
}

type Case = { type: string; data: Record<string, unknown>; field: (tile: Locator, page: Page) => Locator; read: (data: Record<string, unknown>) => unknown };

const promptField = (tile: Locator) => tile.locator('textarea.gen-prompt');
const sourceField = (name: string) => (_tile: Locator, page: Page) => page.getByTestId('source-settings').locator(`input[name="${name}"]`);

const CASES: Case[] = [
  { type: 'text', data: { prompt: '' }, field: promptField, read: (d) => d.prompt },
  { type: 'image', data: { prompt: '' }, field: promptField, read: (d) => d.prompt },
  { type: 'video', data: { prompt: '' }, field: promptField, read: (d) => d.prompt },
  { type: 'products', data: { type: 'shopify', url: UNREACHABLE_STORE, limit: 3 }, field: sourceField('filters.query'), read: (d) => (d.filters as { query?: string } | undefined)?.query },
  { type: 'social_account_feed', data: { platform: 'instagram', handle: '', limit: 3 }, field: sourceField('handle'), read: (d) => d.handle }
];

test.describe('local-first editing never loses or remounts what the user types @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  for (const c of CASES) {
    test(`${c.type}: 5 s of edits through another actor's write and a forced resync keep every keystroke`, async ({ page, session, seedNode, admin }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const node = await seedNode({ type: c.type, x: 0, y: 0, data: c.data });
      await gotoHydrated(page, canvasPath(session));
      const tile = page.locator(`.svelte-flow__node[data-id="${node.id}"]`);
      await tile.click();
      const field = c.field(tile, page);
      await mark(field);

      const typed = await typeFor(page, field, tile, TYPING_MS, async () => {
        await admin.from('nodes').update({ display_name: 'Renamed elsewhere' }).eq('id', node.id);
      });

      expect(await stillMounted(field), 'the field was remounted mid-edit').toBe(true);
      await field.press('Tab');
      await expect.poll(async () => c.read((await nodeRow(admin, node.id)).data), { timeout: 15_000 }).toBe(typed);
      expect((await nodeRow(admin, node.id)).display_name, 'the other actor write was lost').toBe('Renamed elsewhere');

      await gotoHydrated(page, canvasPath(session));
      await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).click();
      await expect(c.field(page.locator(`.svelte-flow__node[data-id="${node.id}"]`), page)).toHaveValue(typed);
    });
  }

  test('two tabs edit different fields of the same node and both are kept', async ({ page, session, seedNode, admin }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'products', x: 0, y: 0, data: { type: 'shopify', url: UNREACHABLE_STORE, limit: 3 } });
    const other = await page.context().newPage();
    for (const tab of [page, other]) {
      await tab.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(tab, canvasPath(session));
      await tab.locator(`.svelte-flow__node[data-id="${node.id}"]`).click();
    }

    const query = (tab: Page) => sourceField('filters.query')(tab.locator('body'), tab);
    const limit = (tab: Page) => sourceField('limit')(tab.locator('body'), tab);

    await query(page).fill('from tab a');
    await query(page).press('Tab');
    await limit(other).fill('9');
    await limit(other).press('Enter');

    await expect.poll(async () => {
      const data = (await nodeRow(admin, node.id)).data;
      return [(data.filters as { query?: string } | undefined)?.query, String(data.limit)];
    }, { timeout: 20_000 }).toEqual(['from tab a', '9']);
    await expect(query(other), 'the second tab never saw the first tab write').toHaveValue('from tab a', { timeout: 15_000 });
    await expect(limit(page), 'the first tab never saw the second tab write').toHaveValue('9', { timeout: 15_000 });
    await other.close();
  });

  test('server errors on writes are retried until the value lands', async ({ page, session, seedNode, admin }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: '' } });
    let failures = 2;
    await page.route(/[?&]action=write(&|$)/, async (route) => {
      if (failures > 0) {
        failures -= 1;
        await route.fulfill({ status: 500, body: 'boom' });
        return;
      }
      await route.continue();
    });
    await gotoHydrated(page, canvasPath(session));
    const tile = page.locator(`.svelte-flow__node[data-id="${node.id}"]`);
    await tile.click();
    await promptField(tile).fill('survives 500s');
    await page.keyboard.press('Tab');

    await expect.poll(async () => (await nodeRow(admin, node.id)).data.prompt, { timeout: 30_000 }).toBe('survives 500s');
    expect(failures).toBe(0);
  });

  test('10 s of offline edits survive closing the tab and land in order once back online', async ({ page, session, seedNode, admin }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const text = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'before' } });
    const products = await seedNode({ type: 'products', x: 500, y: 0, data: { type: 'shopify', url: UNREACHABLE_STORE, limit: 3 } });
    await gotoHydrated(page, canvasPath(session));
    const context = page.context();

    await context.setOffline(true);
    const textTile = page.locator(`.svelte-flow__node[data-id="${text.id}"]`);
    await textTile.click();
    const typed = await typeFor(page, promptField(textTile), textTile, OFFLINE_MS / 2, async () => {});
    await page.locator(`.svelte-flow__node[data-id="${products.id}"]`).click();
    await sourceField('filters.query')(page.locator('body'), page).fill('offline query');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(OFFLINE_MS / 2);

    await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'offline');
    expect((await nodeRow(admin, text.id)).data.prompt, 'an unsent edit reached the server while offline').toBe('before');

    await page.close();
    await context.setOffline(false);
    const back = await context.newPage();
    await back.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(back, canvasPath(session));

    await expect.poll(async () => (await nodeRow(admin, text.id)).data.prompt, { timeout: 30_000 }).toBe(typed);
    await expect.poll(async () => ((await nodeRow(admin, products.id)).data.filters as { query?: string } | undefined)?.query, { timeout: 30_000 }).toBe('offline query');
    await expect(back.locator('.save-status')).toHaveAttribute('data-status', 'saved', { timeout: 15_000 });
  });
});
