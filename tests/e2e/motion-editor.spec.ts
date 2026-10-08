import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const START = /^00:00:00 \//;

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

  test('? apre le scorciatoie, ⌘B chiude la colonna e resta chiusa dopo un reload, ⌥⌘B la riapre su Properties', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    const url = `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`;
    await gotoHydrated(page, url);

    await page.keyboard.press('Shift+?');
    await expect(page.getByTestId('shortcut-help')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcut-help')).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+b');
    await expect(page.getByLabel('Agent', { exact: true })).toBeHidden();
    await expect(page.getByLabel('Properties', { exact: true })).toBeHidden();

    await gotoHydrated(page, url);
    await expect(page.getByTestId('side-column')).toBeHidden();
    await expect(page.getByLabel('Agent', { exact: true })).toBeHidden();

    await page.keyboard.press('ControlOrMeta+Alt+b');
    await expect(page.getByLabel('Properties', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Agent', { exact: true })).toBeHidden();
  });

  test('un clip con keyframe mostra le sue lane con ◆ e la sua curva nel graph editor', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('menuitem', { name: 'feega trailer v2 · 16:9' }).dispatchEvent('click');
    const layer = page.locator('[data-layer="bar-0"]');
    await layer.scrollIntoViewIfNeeded();
    await layer.getByRole('button', { name: 'Show keyframes' }).dispatchEvent('click');
    await expect(page.locator('[data-key-lane="bar-0:scaleY"]')).toBeInViewport();

    const value = page.locator('[data-key-lane="bar-0:scaleY"] .prop-value');
    const before = await value.textContent();
    const box = (await value.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(value).not.toHaveText(before ?? '');

    await page.getByTestId('timeline-more').click();
    await page.getByRole('menuitemcheckbox', { name: 'Graph editor' }).click();
    await expect(page.getByText('Select a clip with keyframes')).toHaveCount(0);
  });

  test('cambiare l’opacità non ricompone: la preview si aggiorna senza ricaricare', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Title', exact: true }).dispatchEvent('click');
    await page.waitForTimeout(3000);

    const how = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const player = document.querySelector('hyperframes-player')!;
          const field = document.querySelector('input.num[aria-label="Opacity"]') as HTMLInputElement;
          window.addEventListener('message', (e) => e.data?.type === 'feega:hot-done' && resolve('patch'));
          player.addEventListener('ready', () => resolve('reload'), { once: true });
          setTimeout(() => resolve('nothing'), 3000);
          field.value = '40';
          field.dispatchEvent(new Event('change', { bubbles: true }));
        })
    );

    expect(how).toBe('patch');
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

test.describe('motion editor top bar @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  for (const width of [1100, 1280]) {
    test(`a ${width}px la barra non ha i toggle dei pannelli e il centro non tocca la destra`, async ({ page, session, seedNode }) => {
      await page.setViewportSize({ width, height: 800 });
      const node = await seedNode({ type: 'motion', data: MOTION_DATA });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

      await expect(page.getByTestId('toggle-chat')).toHaveCount(0);
      await expect(page.getByTestId('toggle-inspector')).toHaveCount(0);

      const centre = (await page.getByRole('group', { name: 'Transport' }).boundingBox())!;
      const right = (await page.getByTestId('bar-trail').boundingBox())!;
      expect(centre.x + centre.width).toBeLessThanOrEqual(right.x);
      const trail = await page.getByTestId('bar-trail').evaluate((el) => el.scrollWidth <= el.clientWidth);
      expect(trail).toBe(true);
    });
  }
});

test.describe('motion editor on a tablet @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('il toggle apre la chat nel cassetto', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByTestId('toggle-chat').tap();
    await expect(page.getByLabel('Agent', { exact: true })).toBeVisible();
  });
});

test.describe('motion editor on a phone @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('si apre, si tocca una clip, si cambia una proprietà e parte il play', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByRole('button', { name: 'Add', exact: true }).tap();
    await page.getByRole('menuitem', { name: 'Title', exact: true }).tap();
    const clip = page.locator('[data-clip-id]').last();
    await clip.scrollIntoViewIfNeeded();
    await clip.tap();

    await page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Properties' }).tap();
    const opacity = page.getByRole('textbox', { name: 'Opacity', exact: true }).first();
    await opacity.fill('50');
    await opacity.press('Enter');
    await expect(opacity).toHaveValue(/^50/);
    await page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Properties' }).tap();

    const timecode = page.getByTestId('timecode');
    await page.getByRole('button', { name: 'Play', exact: true }).tap();
    await expect(timecode).not.toHaveText(START, { timeout: 5000 });
  });

  test('la barra in basso apre la chat', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Agent' }).tap();
    await expect(page.getByLabel('Agent', { exact: true })).toBeVisible();
  });
});

test.describe('preview zoom @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('⌘= ingrandisce, doppio clic intorno torna a Fit, ⌘1 è 100%: la vista cambia, la storia no', async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
    const value = page.getByTestId('preview-zoom-value');
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    await expect(value).toHaveText('Fit');
    await expect(undo).toBeDisabled();

    await page.keyboard.press('ControlOrMeta+=');
    await expect(page.getByTestId('zoom-stage')).toHaveAttribute('data-zoom', /%$/);

    const stage = await page.getByTestId('zoom-stage').boundingBox();
    await page.mouse.dblclick(stage!.x + 4, stage!.y + 4);
    await expect(value).toHaveText('Fit');

    await page.keyboard.press('ControlOrMeta+1');
    await expect(value).toHaveText('100%');
    await page.keyboard.press('ControlOrMeta+0');
    await expect(value).toHaveText('Fit');
    await expect(undo).toBeDisabled();
  });
});
