import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';

const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const MIN_HIT = 44;
const TOUCH_SIZES = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'ipad-landscape', width: 1180, height: 820 }
];
const DESKTOP = { name: 'desktop', width: 1440, height: 900 };
const DRAWN_SMALL = ['.grip', '.key', '.fade', '.whip', '[data-drawn-small]', 'input[type=range]'];
const SHOTS = process.env.TOUCH_SHOTS_DIR;

type Small = { what: string; width: number; height: number };

async function smallTargets(page: Page): Promise<Small[]> {
  return page.evaluate(
    ({ min, drawnSmall }) => {
      const root = document.querySelector('[data-testid=motion-editor]');
      if (!root) {
        return [{ what: 'no editor', width: 0, height: 0 }];
      }
      const targets = root.querySelectorAll<HTMLElement>('button, a[href], [role=button], [role=slider], [role=tab], input, select');
      const small: { what: string; width: number; height: number }[] = [];
      for (const el of targets) {
        if (drawnSmall.some((s) => el.matches(s) || el.closest(s))) {
          continue;
        }
        const target = el.matches('input[type=checkbox], input[type=radio]') ? (el.closest('label') ?? el) : el;
        const box = target.getBoundingClientRect();
        const style = getComputedStyle(el);
        const hidden = box.width === 0 || box.height === 0 || style.visibility === 'hidden' || style.pointerEvents === 'none';
        if (hidden) {
          continue;
        }
        const timed = el.matches('.bar');
        if ((timed || box.width >= min) && box.height >= min) {
          continue;
        }
        const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 24) ?? '';
        small.push({ what: `${el.outerHTML.slice(0, 90)} "${label}"`, width: Math.round(box.width), height: Math.round(box.height) });
      }
      return small;
    },
    { min: MIN_HIT, drawnSmall: DRAWN_SMALL }
  );
}

async function hoverOnly(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid=motion-editor]');
    const unnamed: string[] = [];
    for (const el of root?.querySelectorAll<HTMLElement>('button, [role=button]') ?? []) {
      const named = el.getAttribute('aria-label') || el.textContent?.trim();
      if (!named) {
        unnamed.push(el.outerHTML.slice(0, 80));
      }
    }
    return unnamed;
  });
}

async function openEditor(page: Page, url: string): Promise<void> {
  await gotoHydrated(page, url);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: 'feega trailer v2 · 16:9' }).dispatchEvent('click');
  await page.locator('[data-layer="bar-0"] .bar').first().click();
  const sheet = page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Properties' });
  if (await sheet.isVisible()) {
    await sheet.click();
  }
}

test.describe('motion editor a dito @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  for (const size of TOUCH_SIZES) {
    test.describe(size.name, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true });

      test(`ogni controllo è grande almeno ${MIN_HIT}px e ha un nome`, async ({ page, session, seedNode }) => {
        const node = await seedNode({ type: 'motion', data: MOTION_DATA });
        await openEditor(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);

        if (SHOTS) {
          await page.screenshot({ path: `${SHOTS}/${size.name}.png` });
        }

        const small = await smallTargets(page);
        expect(small, small.map((s) => `${s.what} ${s.width}x${s.height}`).join('\n')).toEqual([]);
        expect(await hoverOnly(page)).toEqual([]);
      });
    });
  }

  test.describe(DESKTOP.name, () => {
    test.use({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });

    test('lo screenshot desktop per la review', async ({ page, session, seedNode }) => {
      test.skip(!SHOTS, 'solo con TOUCH_SHOTS_DIR');
      const node = await seedNode({ type: 'motion', data: MOTION_DATA });
      await openEditor(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
      await page.screenshot({ path: `${SHOTS}/${DESKTOP.name}.png` });
    });
  });

  test('il clock apre un menu timecode / frames', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByTestId('clock').click();
    await page.getByRole('menuitemradio', { name: 'Frames' }).click();
    await expect(page.getByTestId('timecode')).toHaveText(/^0 \//);
  });
});
