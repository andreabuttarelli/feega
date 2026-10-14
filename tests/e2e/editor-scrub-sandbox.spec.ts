import { expect, test } from '@playwright/test';

const PROBE = '/tests/e2e/fixtures/editor-scrub-probe.ts';

const reach = (read: () => unknown) => {
  try {
    read();
    return 'reached';
  } catch {
    return 'blocked';
  }
};

test('the preview stays an opaque, script-only sandbox before and after a tap reaches it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/changelog');
  await page.evaluate(() => (document.cookie = 'feega_probe=1; path=/'));
  await page.evaluate((path) => import(path), PROBE);
  await page.evaluate(() => window.editorScrub.mount());

  const sandboxOf = () => page.evaluate(() => document.querySelector('hyperframes-player')?.shadowRoot?.querySelector('iframe')?.getAttribute('sandbox'));
  const inside = () =>
    page.frames()[1].evaluate((source) => {
      const reach = new Function(`return (${source})`)();
      const leaked = reach(() => {
        if (!document.cookie.includes('feega_probe')) {
          throw new Error('host cookie hidden');
        }
      });
      return { origin: self.origin, cookie: leaked === 'reached' ? 'leaked' : 'hidden', parent: reach(() => parent.document.title), storage: reach(() => localStorage.length) };
    }, reach.toString());

  const sealed = { origin: 'null', cookie: 'hidden', parent: 'blocked', storage: 'blocked' };
  expect(await sandboxOf()).toBe('allow-scripts');
  expect(await inside()).toEqual(sealed);

  await page.evaluate(() => window.editorScrub.listen());
  await page.mouse.click(480, 270);
  await expect.poll(() => page.evaluate(() => window.editorScrub.taps())).toEqual([{ x: 0.5, y: 0.5 }]);

  expect(await sandboxOf()).toBe('allow-scripts');
  expect(await inside()).toEqual(sealed);
});
