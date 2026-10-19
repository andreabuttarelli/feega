import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated, signInE2e } from './fixtures/session';

const DESKTOP = { width: 1440, height: 900 };
const HEAVY = process.env.HEAVY_CANVAS_PATH;
const SETTLE_MS = 4000;
const RENDERERS = ['gpu', 'dom'];

test.use({ viewport: DESKTOP, actionTimeout: 20_000 });

const COUNTERS = () => {
  const counts = { uploads: 0 };
  (window as unknown as { __uploads: typeof counts }).__uploads = counts;
  const wrap = (proto: object | undefined, names: string[]) => {
    for (const name of names) {
      const target = proto as Record<string, (...args: unknown[]) => unknown> | undefined;
      const original = target?.[name];
      if (!target || typeof original !== 'function') {
        continue;
      }
      target[name] = function (this: unknown, ...args: unknown[]) {
        counts.uploads += 1;
        return original.apply(this, args);
      };
    }
  };
  wrap(globalThis.WebGL2RenderingContext?.prototype, ['texImage2D', 'texSubImage2D']);
  wrap(globalThis.WebGLRenderingContext?.prototype, ['texImage2D', 'texSubImage2D']);
  wrap((globalThis as unknown as { GPUQueue?: { prototype: object } }).GPUQueue?.prototype, ['copyExternalImageToTexture', 'writeTexture']);
};

async function mark(page: Page): Promise<number> {
  return page.evaluate(() => {
    const players = [...document.querySelectorAll('video, iframe, canvas')];
    players.forEach((el) => ((el as unknown as { __kept: boolean }).__kept = true));
    (window as unknown as { __uploads: { uploads: number } }).__uploads.uploads = 0;
    return players.length;
  });
}

async function survivors(page: Page): Promise<{ players: number; kept: number; uploads: number }> {
  return page.evaluate(() => {
    const players = [...document.querySelectorAll('video, iframe, canvas')];
    return {
      players: players.length,
      kept: players.filter((el) => (el as unknown as { __kept?: boolean }).__kept).length,
      uploads: (window as unknown as { __uploads: { uploads: number } }).__uploads.uploads
    };
  });
}

test.describe('a teammate edit does not remount what did not change @real', () => {
  test.skip(!REAL_STACK || !HEAVY, 'richiede lo stack vero e HEAVY_CANVAS_PATH');
  test.setTimeout(300_000);

  for (const renderer of RENDERERS) {
    test(`on the ${renderer} canvas`, async ({ page, browser, session, admin }) => {
      const path = `${HEAVY}?renderer=${renderer}`;
      const elsewhere = await browser.newContext({ viewport: DESKTOP });
      const other = await elsewhere.newPage();
      await other.addInitScript(COUNTERS);
      await signInE2e(other, { email: session.email, password: session.password });
      await gotoHydrated(page, path);
      await gotoHydrated(other, path);
      await other.waitForTimeout(SETTLE_MS);
      const canvasId = HEAVY!.split('/c/')[1];

      const before = await mark(other);
      await page.locator('.svelte-flow__pane, .gpu-flow, [data-gpu-flow]').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('Shift+ArrowRight');
      await other.waitForTimeout(SETTLE_MS);
      const afterMove = await survivors(other);

      await mark(other);
      const { data: rows } = await admin.from('nodes').select('id, data').eq('canvas_id', canvasId).eq('type', 'text').is('deleted_at', null).limit(1);
      const text = rows?.[0];
      if (text) {
        await admin.from('nodes').update({ data: { ...(text.data as object), prompt: `edited ${Date.now()}` } }).eq('id', text.id);
      }
      await other.waitForTimeout(SETTLE_MS);
      const afterData = await survivors(other);

      console.log(JSON.stringify({ renderer, before, afterMove, afterData, editedTextNode: !!text }));
      if (text) {
        await admin.from('nodes').update({ data: text.data }).eq('id', text.id);
      }
      await page.keyboard.press('Shift+ArrowLeft');
      await page.waitForTimeout(1500);
      expect(afterMove.kept).toBe(afterMove.players);
      expect(afterData.kept).toBe(afterData.players);
      await elsewhere.close();
    });
  }
});
