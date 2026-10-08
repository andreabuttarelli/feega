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

const LONG_PRESS_HOLD_MS = 800;
const EDGE_PX = 24;

async function longPress(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const right = page.viewportSize()!.width - EDGE_PX;
  const point = { x: Math.min(box.x + box.width / 2, right), y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(LONG_PRESS_HOLD_MS);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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

  for (const size of [...TOUCH_SIZES, DESKTOP]) {
    test.describe(`${size.name} comandi`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('undo e redo stanno nella barra, la toolbar ha al massimo sei controlli', async ({ page, session, seedNode }) => {
        const node = await seedNode({ type: 'motion', data: MOTION_DATA });
        await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

        const bar = page.locator('header.bar');
        await expect(bar.getByRole('button', { name: 'Undo', exact: true })).toBeInViewport();
        await expect(bar.getByRole('button', { name: 'Redo', exact: true })).toBeInViewport();

        const toolbar = page.locator('.toolbar');
        expect(await toolbar.locator(':scope > button, :scope > * > button').count()).toBeLessThanOrEqual(6);

        await page.getByTestId('timeline-more').click();
        await expect(page.getByTestId('overflow-menu')).toBeInViewport();
        await expect(page.getByRole('menuitem', { name: /Nudge 1 frame earlier/ })).toBeVisible();
        if (SHOTS) {
          await page.screenshot({ path: `${SHOTS}/${size.name}-menu.png` });
        }
      });
    });
  }

  test.describe('clip a dito', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('una pressione lunga sul clip apre il suo menu, e da lì si sceglie il parent', async ({ page, session, seedNode }) => {
      const node = await seedNode({ type: 'motion', data: MOTION_DATA });
      await openEditor(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
      await page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Properties' }).click();

      await expect(page.getByTestId('clip-bar')).toBeVisible();
      await longPress(page, '[data-layer="bar-1"] .bar');
      const menu = page.getByRole('menu', { name: 'Clip' });
      await expect(menu).toBeVisible();
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/iphone-clip-menu.png` });
      }

      await menu.getByRole('menuitem', { name: 'Parent to…' }).click();
      await page.getByRole('menu', { name: 'Parent to' }).getByRole('menuitem').nth(1).click();
      await expect(page.locator('[data-layer="bar-1"] em.parent')).toBeAttached();
    });

    test('Select several aggiunge clip con un tocco, senza tasti', async ({ page, session, seedNode }) => {
      const node = await seedNode({ type: 'motion', data: MOTION_DATA });
      await openEditor(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
      await page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Properties' }).click();

      await page.getByTestId('clip-bar').getByRole('button', { name: 'Select several' }).click();
      await page.locator('[data-layer="bar-1"] .bar').first().tap();
      await expect(page.getByTestId('clip-bar')).toContainText('2 selected');
      await page.getByTestId('clip-bar').getByRole('button', { name: 'Done' }).click();
      await expect(page.getByTestId('clip-bar')).not.toContainText('selected');
    });
  });

  test('il tasto destro apre lo stesso menu del clip', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await openEditor(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.locator('[data-layer="bar-1"] .bar').first().click({ button: 'right' });
    await expect(page.getByRole('menu', { name: 'Clip' }).getByRole('menuitem', { name: 'Parent to…' })).toBeVisible();
  });

  test('il clock apre un menu timecode / frames', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByTestId('clock').click();
    await page.getByRole('menuitemradio', { name: 'Frames' }).click();
    await expect(page.getByTestId('timecode')).toHaveText(/^0 \//);
  });
});
