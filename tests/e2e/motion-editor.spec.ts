import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const START = /^0:00\.00 \//;

test.describe('motion editor @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('Play fa avanzare il playhead, Spazio lo ferma', async ({ page, session, seedNode }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (e) => errors.push(e.message));

    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
    const timecode = page.getByTestId('timecode');
    await expect(timecode).toHaveText(START);
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(timecode).not.toHaveText(START, { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    const stopped = await timecode.textContent();
    await page.waitForTimeout(500);
    await expect(timecode).toHaveText(stopped ?? '');

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('? apre le scorciatoie, ⌘B e ⌥⌘B chiudono i pannelli e restano chiusi dopo un reload', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    const url = `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`;
    await gotoHydrated(page, url);

    await page.keyboard.press('Shift+?');
    await expect(page.getByTestId('shortcut-help')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcut-help')).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.press('ControlOrMeta+Alt+b');
    await expect(page.getByLabel('Agent', { exact: true })).toBeHidden();
    await expect(page.getByLabel('Properties', { exact: true })).toBeHidden();

    await gotoHydrated(page, url);
    await expect(page.getByTestId('toggle-chat')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByLabel('Agent', { exact: true })).toBeHidden();
  });

  test('un clip con keyframe mostra le sue lane con ◆ e la sua curva nel graph editor', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('menuitem', { name: 'feega trailer v2 · 16:9' }).dispatchEvent('click');
    const bar = page.locator('[data-clip-id="bar-0"]');
    await bar.scrollIntoViewIfNeeded();
    await bar.getByRole('button', { name: 'Show keyframes' }).dispatchEvent('click');
    await expect(page.locator('[data-key-lane="bar-0:scaleY"]')).toBeInViewport();

    await page.getByTestId('graph-toggle').click();
    await expect(page.getByText('Select a clip with keyframes')).toHaveCount(0);
  });

  test('una scorciatoia non scatta mentre si scrive in un campo', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByPlaceholder('Search layers').fill('l ');
    await page.keyboard.press('Home');
    await page.waitForTimeout(500);

    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page.getByTestId('timecode')).toHaveText(START);
  });
});
