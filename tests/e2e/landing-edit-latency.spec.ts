import { test, expect, devices, webkit } from '@playwright/test';
import { login, openFrame } from './fixtures/heavy-canvas';
import heavy from './fixtures/heavy-canvas-landings.json' with { type: 'json' };
import { REDRAWN, REDRAW_QUIET_MS } from '../../src/lib/motion/hyperframes/measure';

const LANDING = heavy.landings[0].desktop.nodeId;
const MAX_EDIT_P50_MS = 500;
const EDITS = 6;
const NUDGE_PX = 8;
const SETTLE_MS = 12_000;
const REDRAW_WAIT_MS = 15_000;
const BETWEEN_EDITS_MS = 1_500;
const OFFSET_X = 'input.num[aria-label="Offset X"]';

type Redraws = { redraws: number[] };

test.describe('editing a 274-clip landing in desktop WebKit @real', () => {
  test.skip(!process.env.E2E_HEAVY_PHONE || !process.env.E2E_TEST_EMAIL, 'needs E2E_HEAVY_PHONE=1 and the test account on the heavy canvas copy');
  test.setTimeout(180_000);

  test('a nudge reaches the preview within half a second', async ({ baseURL }) => {
    const browser = await webkit.launch();
    const page = await (await browser.newContext({ ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })).newPage();
    await login(page, baseURL!);
    await page.goto(`${baseURL}/p/${heavy.projectId}/c/${heavy.canvasId}`);
    await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    await openFrame(page, LANDING);
    const x = page.locator(OFFSET_X).first();
    await page.getByRole('tab', { name: 'Properties' }).or(page.getByRole('button', { name: 'Properties', exact: true })).first().click();
    await expect(x).toBeVisible({ timeout: SETTLE_MS });
    const was = Number((await x.inputValue()) || 0);
    await page.evaluate((type) => {
      const w = window as unknown as Redraws;
      w.redraws = [];
      addEventListener('message', (e) => {
        if (e.data?.type === type) {
          w.redraws.push(performance.now());
        }
      });
    }, REDRAWN);

    const latencies: number[] = [];
    for (let i = 0; i < EDITS; i++) {
      await x.fill(String(i % 2 === 0 ? was + NUDGE_PX : was));
      const sent = await page.evaluate(() => {
        (window as unknown as Redraws).redraws = [];
        return performance.now();
      });
      await x.press('Enter');
      const drawn = await (await page.waitForFunction(() => (window as unknown as Redraws).redraws[0], null, { timeout: REDRAW_WAIT_MS })).jsonValue();
      latencies.push(Math.round(drawn - sent - REDRAW_QUIET_MS));
      await page.waitForTimeout(BETWEEN_EDITS_MS);
    }
    await browser.close();

    const p50 = [...latencies].sort((a, b) => a - b)[Math.floor(EDITS / 2)];
    console.log(`landing edit → preview redrawn: ${latencies.join(', ')} ms (p50 ${p50})`);
    expect(p50).toBeLessThanOrEqual(MAX_EDIT_P50_MS);
  });
});
