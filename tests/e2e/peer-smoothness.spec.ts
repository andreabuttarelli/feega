import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated, signInE2e } from './fixtures/session';

const DESKTOP = { width: 1280, height: 860 };
const SAMPLE_MS = 4000;
const STEP_MS = 16;
const RADIUS_PX = 180;
const CENTRE = { x: 640, y: 430 };
const TURN_MS = 2000;
const VIDEO_DIR = process.env.PEER_SMOOTHNESS_VIDEO;

test.use({ viewport: DESKTOP, actionTimeout: 15_000, ...(VIDEO_DIR ? { video: { mode: 'on', size: DESKTOP } } : {}) });

type Sample = { t: number; x: number; y: number };

async function watch(page: Page, ms: number): Promise<{ samples: Sample[]; frames: number[] }> {
  return page.evaluate((duration) => new Promise((resolve) => {
    const samples: Sample[] = [];
    const frames: number[] = [];
    const began = performance.now();
    let last = began;
    const step = (now: number) => {
      frames.push(now - last);
      last = now;
      const el = document.querySelector('[data-testid="peer-cursor"]');
      if (el) {
        const box = el.getBoundingClientRect();
        samples.push({ t: now, x: box.left, y: box.top });
      }
      if (now - began < duration) {
        requestAnimationFrame(step);
        return;
      }
      resolve({ samples, frames });
    };
    requestAnimationFrame(step);
  }), ms);
}

function deviation(samples: Sample[]): number {
  const offs = samples.slice(1, -1).map((s, i) => {
    const a = samples[i];
    const b = samples[i + 2];
    return Math.hypot(s.x - (a.x + b.x) / 2, s.y - (a.y + b.y) / 2);
  });
  return offs.reduce((sum, d) => sum + d, 0) / Math.max(1, offs.length);
}

function stalls(samples: Sample[]): number {
  const moved = samples.slice(1).filter((s, i) => s.x === samples[i].x && s.y === samples[i].y).length;
  return moved / Math.max(1, samples.length - 1);
}

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.floor(values.length * p)] ?? NaN;

test.describe('remote motion looks continuous @real', () => {
  test.skip(!REAL_STACK, 'richiede lo stack vero: E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('a peer cursor moving in a circle arrives smooth', async ({ page, browser, session }) => {
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const elsewhere = await browser.newContext({ viewport: DESKTOP, ...(VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: DESKTOP } } : {}) });
    const other = await elsewhere.newPage();
    await signInE2e(other, { email: session.email, password: session.password });
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);
    await page.mouse.move(CENTRE.x + RADIUS_PX, CENTRE.y);
    await expect(other.getByTestId('peer-cursor')).toBeVisible({ timeout: 10_000 });

    const moving = (async () => {
      const began = Date.now();
      while (Date.now() - began < SAMPLE_MS + 500) {
        const angle = ((Date.now() - began) / TURN_MS) * 2 * Math.PI;
        await page.mouse.move(CENTRE.x + RADIUS_PX * Math.cos(angle), CENTRE.y + RADIUS_PX * Math.sin(angle));
        await page.waitForTimeout(STEP_MS);
      }
    })();
    const seen = await watch(other, SAMPLE_MS);
    await moving;

    const report = {
      deviationPx: Number(deviation(seen.samples).toFixed(2)),
      stalledFrames: Number(stalls(seen.samples).toFixed(3)),
      frameMs: { p50: percentile(seen.frames, 0.5), p95: percentile(seen.frames, 0.95) }
    };
    console.log(JSON.stringify({ peerSmoothness: report }));
    await elsewhere.close();
  });
});
