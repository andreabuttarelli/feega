import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import type { Page } from '@playwright/test';
import { landingDoc } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { frameHost, openCanvas } from './seed';

const LANDING_DATA = { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const LANDING_SIZE = { width: 1440, height: 4480 };
const SITE = 'http://ledgerline.test';
const READ_MS = 1600;
const PHONE_WIDTH = 390;
const BAR_H = 52;
const TITLE_OFFSET_PX = 5;
const PAN_X = 240;
const ZOOM_IN_WHEEL = -90;

const MIME: Record<string, string> = { html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml' };

const browserTab = `<!doctype html><html><head><style>
  html, body { margin: 0; height: 100%; background: #d9dce1; font: 14px/1 Inter, system-ui, sans-serif; }
  .window { position: absolute; inset: 24px; display: flex; flex-direction: column; background: #e9ebee; border-radius: 10px; overflow: hidden; box-shadow: 0 20px 60px rgba(14,17,22,.18); }
  .bar { height: ${BAR_H}px; flex: none; display: flex; align-items: center; gap: 16px; padding: 0 18px; }
  .dots { display: flex; gap: 8px; } .dots i { width: 12px; height: 12px; border-radius: 50%; background: #c4c8cf; }
  .url { flex: 1; max-width: 560px; margin: 0 auto; padding: 9px 14px; border-radius: 6px; background: #fff; color: #3d4451; }
  .stage { flex: 1; display: flex; justify-content: center; background: #cfd3d9; min-height: 0; padding: 0 28px; }
  .view { position: relative; width: 100%; height: 100%; }
  iframe { width: 100%; height: 100%; border: 0; background: #fff; display: block; }
  .grip { position: absolute; top: 50%; right: -19px; width: 10px; height: 64px; margin-top: -32px; border-radius: 5px; background: #8a909a; cursor: ew-resize; }
</style></head><body><div class="window">
  <div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">ledgerline.test/index.html</div></div>
  <div class="stage"><div class="view" id="view"><iframe src="${SITE}/index.html"></iframe><div class="grip" id="grip"></div></div></div>
</div><script>
  const view = document.getElementById('view');
  const grip = document.getElementById('grip');
  let dragging = false;
  const frame = view.querySelector('iframe');
  grip.addEventListener('mousedown', () => { dragging = true; frame.style.pointerEvents = 'none'; });
  addEventListener('mouseup', () => { dragging = false; frame.style.pointerEvents = ''; });
  addEventListener('mousemove', (m) => {
    if (!dragging) return;
    const stage = view.parentElement.getBoundingClientRect();
    const mid = stage.left + stage.width / 2;
    view.style.width = Math.max(${PHONE_WIDTH}, (m.clientX - 19 - mid) * 2) + 'px';
  });
</script></body></html>`;

async function serveExport(page: Page, zip: string) {
  const files = unzipSync(new Uint8Array(readFileSync(zip)));
  const byPath = new Map(Object.entries(files).map(([path, bytes]) => [path.split('/').slice(1).join('/'), bytes]));
  await page.route(`${SITE}/**`, (route) => {
    const path = new URL(route.request().url()).pathname.slice(1);
    if (path === 'tab') {
      return route.fulfill({ contentType: MIME.html, body: browserTab });
    }
    const bytes = byPath.get(path);
    if (!bytes) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.split('.').pop() ?? ''] ?? 'text/plain', body: strFromU8(bytes) });
  });
}

test('export code', async ({ page, session, admin, seedNode }) => {
  const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDING_DATA });
  expect((await admin.from('nodes').update(LANDING_SIZE).eq('id', node.id)).error).toBeNull();
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: landingDoc(), actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();

  await installCursor(page);
  await openCanvas(page, session);
  const frame = frameHost(page, node.id);
  await expect(frame).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const fit = (await frame.boundingBox())!;
  await page.mouse.move(fit.x, fit.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, ZOOM_IN_WHEEL);
  await page.keyboard.up('Control');
  await page.mouse.wheel(PAN_X, 0);
  await page.waitForTimeout(2500);

  await recordDemo(page, { slug: 'export-code', title: 'export code' }, async (d) => {
    const box = (await frame.boundingBox())!;
    await d.click({ x: box.x + TITLE_OFFSET_PX, y: box.y - TITLE_OFFSET_PX });
    await d.wait(1200);

    await d.click(page.getByTestId('editor-mode-switch').locator('[data-mode=code]'));
    const code = page.getByTestId('dev-code');
    await expect(code).toBeVisible({ timeout: 15_000 });
    await d.look((await code.boundingBox())!, READ_MS);

    for (const target of ['svelte', 'html']) {
      await d.click(page.getByTestId(`dev-code-target-${target}`));
      await d.look((await code.boundingBox())!, READ_MS);
    }

    await d.click(page.getByTestId('dev-code-copy'));
    await expect(page.getByTestId('dev-code-copy')).toHaveText('Copied');
    await d.wait(900);

    const downloading = page.waitForEvent('download');
    await d.click(page.getByTestId('dev-code-download'));
    const zip = await (await downloading).path();
    await d.wait(1200);

    await serveExport(page, zip);
    await page.goto(`${SITE}/tab`);
    await page.frameLocator('iframe').locator('body').waitFor();
    await d.wait(READ_MS);

    const grip = (await page.locator('#grip').boundingBox())!;
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    const view = (await page.locator('.stage').boundingBox())!;
    const to = { x: view.x + view.width / 2 + PHONE_WIDTH / 2, y: from.y };
    await d.drag(from, to, undefined, view);
    await d.wait(READ_MS);
    await page.frameLocator('iframe').locator('html').evaluate((el) => el.ownerDocument.defaultView!.scrollTo({ top: 900, behavior: 'smooth' }));
    await d.wait(READ_MS);
  });
});
