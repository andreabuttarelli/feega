import { homedir } from 'node:os';
import { join } from 'node:path';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = join(homedir(), 'Documents/feega-videos/chat-background');
const PROMPT = 'Write forty short numbered sentences about the sea, then end with the word: done';
const AWAY_MS = 8_000;
const STEPPED_PROMPT = 'First list the nodes on this canvas with your tool. Then write forty short numbered sentences about the sea, then end with the word: done';

async function leave(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => (window as unknown as { __streaming: () => boolean }).__streaming());
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.context().setOffline(true);
  await page.evaluate(() => (window as unknown as { __cutChat: () => void }).__cutChat());
}

async function comeBack(page: import('@playwright/test').Page) {
  await page.context().setOffline(false);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
  });
}

function cuttableChatStream() {
  const native = window.fetch.bind(window);
  const cuts: Array<() => void> = [];
  Object.assign(window, { __cutChat: () => cuts.splice(0).forEach((cut) => cut()), __streaming: () => cuts.length > 0 });
  window.fetch = async (input, init) => {
    const res = await native(input, init);
    if (init?.method !== 'POST' || !String(input).endsWith('/agent') || !res.body) {
      return res;
    }
    const reader = res.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        cuts.push(() => {
          controller.error(new TypeError('Load failed'));
          void reader.cancel();
        });
      },
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      }
    });
    return new Response(body, { status: res.status, headers: res.headers });
  };
}

test.describe('chat in a backgrounded tab @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a tab that goes away mid-turn keeps the transcript and gets the answer when it comes back', async ({ page, session }) => {
    test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY assente: salto la chiamata reale');
    test.setTimeout(180_000);

    await page.addInitScript(cuttableChatStream);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator('#chat-composer-input').fill(PROMPT);
    await page.locator('#chat-composer-input').press('Enter');
    await expect(page.locator('.msg.is-user')).toContainText('the sea');
    await page.screenshot({ path: join(SHOTS, '1-sent.png') });

    await page.waitForFunction(() => (window as unknown as { __streaming: () => boolean }).__streaming());
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.context().setOffline(true);
    await page.evaluate(() => (window as unknown as { __cutChat: () => void }).__cutChat());
    await expect(page.locator('.reconnecting')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: join(SHOTS, '2-away.png') });

    await expect(page.locator('.msg.is-user')).toContainText('the sea');
    await expect(page.locator('.dock .banner')).toHaveCount(0);

    await page.waitForTimeout(AWAY_MS);
    await page.context().setOffline(false);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('online'));
    });

    await expect(page.locator('.msg.is-assistant').last()).toContainText(/done/i, { timeout: 120_000 });
    await expect(page.locator('.msg.is-user')).toContainText('the sea');
    await expect(page.locator('.dock .banner')).toHaveCount(0);
    await page.screenshot({ path: join(SHOTS, '3-back.png') });
  });

  test('coming back mid-turn shows the steps done meanwhile, then the final answer', async ({ page, session }) => {
    test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY assente: salto la chiamata reale');
    test.setTimeout(180_000);

    await page.addInitScript(cuttableChatStream);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator('#chat-composer-input').fill(STEPPED_PROMPT);
    await page.locator('#chat-composer-input').press('Enter');
    await leave(page);
    await expect(page.locator('.reconnecting')).toBeVisible({ timeout: 15_000 });

    await page.waitForTimeout(AWAY_MS);
    await comeBack(page);

    const answer = page.locator('.msg.is-assistant').last();
    await expect(answer.locator('.tools .tool').first()).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: join(SHOTS, '4-partial.png') });

    await expect(answer).toContainText(/done/i, { timeout: 120_000 });
    await expect(page.locator('.msg.is-assistant')).toHaveCount(1);
    await expect(page.locator('.dock .banner')).toHaveCount(0);
    await page.screenshot({ path: join(SHOTS, '5-final.png') });
  });
});
