import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SERVER_LAG_MS = 700;
const CLICK_AFTER_MS = 50;
const TYPING_MS = 5_000;
const KEY_DELAY_MS = 25;
const UNREACHABLE_STORE = 'https://store.example.invalid';
const PROMPT_PLACEHOLDER = 'What should it be about…';
const LOADING_SELECTORS = '[aria-busy="true"], .is-spinning';

async function slowServer(page: Page) {
  await page.route(/\?\/|\/session$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SERVER_LAG_MS));
    await route.continue();
  });
}

async function nodeRow(admin: SupabaseClient, id: string) {
  return (await admin.from('nodes').select('data, version').eq('id', id).single()).data as { data: Record<string, unknown>; version: number };
}

type Sent = { fields: Map<string, string>; version: number; dbVersion: number; dbData: Record<string, unknown> };

function formFields(body: string): Map<string, string> {
  return new Map([...body.matchAll(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g)].map((m) => [m[1], m[2]]));
}

async function stopBeforeSpending(page: Page, action: string, admin: SupabaseClient, nodeId: string): Promise<Sent[]> {
  const sent: Sent[] = [];
  await page.route(new RegExp(`\\?/${action}$`), async (route) => {
    const fields = formFields(route.request().postData() ?? '');
    const row = await nodeRow(admin, nodeId);
    sent.push({ fields, version: Number(fields.get('version')), dbVersion: row.version, dbData: row.data });
    await route.abort();
  });
  return sent;
}

async function noConflict(page: Page) {
  await expect(page.getByRole('alert').filter({ hasText: /changed this node|someone/i })).toHaveCount(0);
}

test.describe('own pending writes never block or fail a run @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  for (const seed of [
    { type: 'products', field: 'limit', value: '7', data: { type: 'shopify', url: UNREACHABLE_STORE, limit: 3 } },
    { type: 'social_account_feed', field: 'handle', value: 'feega', data: { platform: 'instagram', handle: 'nike', limit: 3 } }
  ]) {
    test(`${seed.type}: edit ${seed.field} then sync within 50 ms sends the new value at the current version`, async ({ page, session, seedNode, admin }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const node = await seedNode({ type: seed.type, x: 0, y: 0, data: seed.data });
      await slowServer(page);
      const sent = await stopBeforeSpending(page, 'sync', admin, node.id);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).click();
      const settings = page.getByTestId('source-settings');
      const input = settings.locator(`input[name="${seed.field}"]`);

      await input.fill(seed.value);
      await input.press('Enter');
      await page.waitForTimeout(CLICK_AFTER_MS);
      await settings.getByRole('button', { name: /sync now/i }).click();

      await expect.poll(() => sent.length, { timeout: 20_000 }).toBe(1);
      expect(String(sent[0].dbData[seed.field]), 'the sync left before the edit was saved').toBe(seed.value);
      expect(sent[0].version, 'the sync carried a stale version').toBe(sent[0].dbVersion);
    });
  }

  test('a prompt edited then Generate within 50 ms runs with the new prompt and the current version', async ({ page, session, seedNode, admin }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'old prompt' } });
    await slowServer(page);
    const sent = await stopBeforeSpending(page, 'run', admin, node.id);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const tile = page.locator(`.svelte-flow__node[data-id="${node.id}"]`);
    await tile.click();
    const prompt = tile.getByPlaceholder(PROMPT_PLACEHOLDER);
    await prompt.fill('new prompt');
    await page.waitForTimeout(CLICK_AFTER_MS);
    await tile.getByRole('button', { name: /^Generate/ }).click();

    await expect.poll(() => sent.length, { timeout: 20_000 }).toBe(1);
    expect(sent[0].fields.get('prompt')).toBe('new prompt');
    expect(sent[0].dbData.prompt, 'the run left before the prompt was saved').toBe('new prompt');
    expect(sent[0].version, 'the run carried a stale version').toBe(sent[0].dbVersion);
  });

  test('typing 5 s in a source field shows no loading state and lands the final value', async ({ page, session, seedNode, admin }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'products', x: 0, y: 0, data: { type: 'shopify', url: UNREACHABLE_STORE, limit: 3 } });
    await slowServer(page);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).click();
    const settings = page.getByTestId('source-settings');
    const input = settings.locator('input[name="filters.query"]');
    await input.click();

    let typed = '';
    const until = Date.now() + TYPING_MS;
    while (Date.now() < until) {
      await input.pressSequentially('ab', { delay: KEY_DELAY_MS });
      await input.press('Tab');
      await input.click();
      typed += 'ab';
      await expect(page.locator(`.svelte-flow__node[data-id="${node.id}"]`).locator(LOADING_SELECTORS)).toHaveCount(0);
      await expect(input).toHaveValue(typed);
    }

    await expect.poll(async () => ((await nodeRow(admin, node.id)).data.filters as { query?: string } | undefined)?.query, { timeout: 15_000 }).toBe(typed);
    await expect(input).toHaveValue(typed);
    await noConflict(page);
  });
});
