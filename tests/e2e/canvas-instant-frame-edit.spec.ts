import { appendFileSync, mkdirSync } from 'node:fs';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const INSTANT_MS = 150;
const THROTTLED_MS = 600;
const IDLE_MS = 2_000;
const OPEN_TIMEOUT_MS = 20_000;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const OUT = process.env.INSTANT_FRAME_OUT;

enum Device {
  Desktop = 'desktop',
  Phone = 'phone'
}

const PROFILE: Record<Device, { viewport: { width: number; height: number }; cpuSlowdown: number; budgetMs: number }> = {
  [Device.Desktop]: { viewport: { width: 1440, height: 900 }, cpuSlowdown: 1, budgetMs: INSTANT_MS },
  [Device.Phone]: { viewport: { width: 390, height: 844 }, cpuSlowdown: 4, budgetMs: THROTTLED_MS }
};

function record(device: Device, ms: number) {
  if (!OUT) {
    return;
  }
  mkdirSync(OUT, { recursive: true });
  appendFileSync(`${OUT}/timings.tsv`, `${device}\t${ms}\n`);
}

async function watchOpen(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { sawLoading: boolean; pressedAt: number; editableAt: number };
    w.sawLoading = false;
    addEventListener('pointerdown', (e) => (w.pressedAt ??= e.timeStamp), { capture: true });
    new MutationObserver(() => {
      if (document.querySelector('[data-testid=inline-motion-loading]')) {
        w.sawLoading = true;
      }
      if (document.querySelector('[data-testid=selection-box]')) {
        w.editableAt ??= performance.now();
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}

test.use({ video: OUT ? 'on' : 'off' });

for (const device of [Device.Desktop, Device.Phone]) {
  const profile = PROFILE[device];

  test.describe(`opening a frame on ${device} @real`, () => {
    test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
    test.use({ viewport: profile.viewport });
    test.setTimeout(90_000);

    test('opening a one-box frame shows editable selection within 150 ms and never shows a loading state or navigates', async ({ page, session, admin, seedNode }) => {
      const node = await seedNode({ type: 'motion', x: 40, y: 120, data: LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdown });

      const canvasUrl = `/p/${session.projectId}/c/${session.canvasId}`;
      await gotoHydrated(page, canvasUrl);
      const stage = page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId('motion-node-stage');
      await expect(stage).toBeVisible({ timeout: OPEN_TIMEOUT_MS });
      await page.waitForTimeout(IDLE_MS);
      await watchOpen(page);

      const box = (await stage.boundingBox())!;
      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: OPEN_TIMEOUT_MS });
      const elapsed = Math.round(await page.evaluate(() => {
        const w = window as unknown as { pressedAt: number; editableAt: number };
        return w.editableAt - w.pressedAt;
      }));
      record(device, elapsed);

      expect(new URL(page.url()).pathname, 'the canvas never navigates').toBe(canvasUrl);
      expect(await page.evaluate(() => (window as unknown as { sawLoading: boolean }).sawLoading), 'no loading state').toBe(false);
      expect(elapsed, 'the frame is editable at once').toBeLessThan(profile.budgetMs);
    });
  });
}
