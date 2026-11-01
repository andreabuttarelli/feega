import { appendFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent } from '../../src/lib/motion/main-component';
import { addVariant } from '../../src/lib/motion/variants';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const OUT = process.env.THUMBS_OUT ?? 'test-results/components-thumbs-perf.jsonl';
const COUNTS = (process.env.THUMBS_COUNTS ?? '20,50,100').split(',').map(Number);
const PER_FRAME = 10;
const HEAVY_EVERY = 5;
const HEAVY_CLIPS = 60;
const FRAME_DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PHONE_CPU = 4;
const FAST_3G = { offline: false, latency: 562.5, downloadThroughput: ((1.6 * 1024 * 1024) / 8) * 0.9, uploadThroughput: ((750 * 1024) / 8) * 0.9 };
const DONE_TIMEOUT_MS = 600_000;

enum Profile {
  Desktop = 'desktop',
  Phone = 'phone'
}

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function frameDoc(frame: number, mains: number): MotionDoc {
  let n = 0;
  const id = () => `f${frame}x${++n}`;
  let doc = newMotionDoc(MotionFormat.Landscape);
  for (let m = 0; m < mains; m++) {
    const heavy = m % HEAVY_EVERY === 0;
    const clips: string[] = [];
    const count = heavy ? HEAVY_CLIPS : 2;
    for (let c = 0; c < count; c++) {
      const clipId = `m${m}c${c}`;
      const text = c % 3 === 1;
      const props = text
        ? { text: `Label ${frame}.${m}.${c}`, size: 0.03, x: 0.1 + (c % 10) * 0.08, y: 0.1 + Math.floor(c / 10) * 0.12, width: 0.2, height: 0.06, color: '#111111' }
        : { shape: c % 2 ? 'ellipse' : 'rect', x: 0.1 + (c % 10) * 0.08, y: 0.1 + Math.floor(c / 10) * 0.12, width: 0.07, height: 0.1, corners: [0.2], fill: `#${(((m * 37 + c * 11) * 99991) % 0xffffff).toString(16).padStart(6, "0")}` };
      doc = must(addClip(doc, { component: text ? 'Text' : 'Shape', from: 0, durationInFrames: 90, props }, clipId));
      clips.push(clipId);
    }
    const before = new Set(Object.keys(doc.comps));
    doc = must(createComponent(doc, clips, id, `Comp ${frame}.${m}${heavy ? ' heavy' : ''}`));
    const compId = Object.keys(doc.comps).find((k) => !before.has(k))!;
    doc = must(addVariant(doc, compId, { State: 'Hover' }, id));
  }
  return doc;
}

async function instrument(page: Page) {
  page.on('console', (m) => m.text().startsWith('[thumbT]') && process.env.THUMBS_TRACE && console.log(m.text()));
  await page.addInitScript(() => {
    const w = window as unknown as { __perf: { long: number[]; devices: number; sources: number } };
    w.__perf = { long: [], devices: 0, sources: 0 };
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__perf.long.push(e.duration))).observe({ type: 'longtask', buffered: true });
    const proto = (globalThis as unknown as { GPUAdapter?: { prototype: { requestDevice: (...a: unknown[]) => unknown } } }).GPUAdapter?.prototype;
    if (proto) {
      const real = proto.requestDevice;
      proto.requestDevice = function (...a: unknown[]) {
        w.__perf.devices++;
        return real.apply(this, a);
      };
    }
  });
}

async function measureOpen(page: Page, total: number) {
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { long: number[] } };
    w.__perf.long = [];
  });
  const started = Date.now();
  await page.getByRole('button', { name: 'Components', exact: true }).first().click();
  await expect(page.getByTestId('component-row')).toHaveCount(total, { timeout: 300_000 });
  await expect(page.locator('[data-testid="component-preview"] canvas.drawn').first()).toBeVisible({ timeout: DONE_TIMEOUT_MS });
  const first = Date.now() - started;

  const scroller = await page.getByTestId('project-components').evaluateHandle((el) => {
    let node: HTMLElement | null = el as HTMLElement;
    while (node && !(node.scrollHeight > node.clientHeight + 4 && getComputedStyle(node).overflowY !== 'visible')) {
      node = node.parentElement;
    }
    return node ?? document.scrollingElement!;
  });
  const drawn = () => page.locator('[data-testid="component-preview"] canvas.drawn').count();
  const visibleDone = async () =>
    page.evaluate(() => {
      const tiles = [...document.querySelectorAll('[data-testid="component-preview"]')];
      const inView = tiles.filter((t) => {
        const r = t.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight && r.width > 0;
      });
      return inView.every((t) => t.querySelector('canvas.drawn'));
    });
  while (!(await visibleDone())) {
    await page.waitForTimeout(50);
  }
  const visible = Date.now() - started;

  while ((await drawn()) < total) {
    if (Date.now() - started > DONE_TIMEOUT_MS) {
      break;
    }
    await scroller.evaluate((el) => el.scrollBy(0, el.clientHeight * 0.8));
    await page.waitForTimeout(100);
  }
  const all = Date.now() - started;
  const stats = await page.evaluate(() => {
    const w = window as unknown as { __perf: { long: number[]; devices: number } };
    const sources = performance.getEntriesByType('resource').filter((r) => r.name.includes('/source?')).length;
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    return { longTasks: w.__perf.long.length, longTaskMs: Math.round(w.__perf.long.reduce((a, b) => a + b, 0)), maxLongTaskMs: Math.round(Math.max(0, ...w.__perf.long)), devices: w.__perf.devices, sourceFetches: sources, heapMb: Math.round(heap / 1048576) };
  });
  return { first, visible, all, drawn: await drawn(), ...stats };
}

test.describe('components panel thumbnails perf @real', () => {
  test.skip(!REAL_STACK || process.env.THUMBS_PERF !== '1', 'requires E2E_REAL_STACK=1 and THUMBS_PERF=1');

  for (const profile of [Profile.Desktop, Profile.Phone]) {
    for (const mains of COUNTS) {
      test(`${profile} ${mains} main components`, async ({ page, session, admin, seedNode }) => {
        test.setTimeout(DONE_TIMEOUT_MS * 3);
        const frames = Math.ceil(mains / PER_FRAME);
        for (let f = 0; f < frames; f++) {
          const node = await seedNode({ type: 'motion', x: f * 2000, y: 0, data: FRAME_DATA });
          const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: frameDoc(f, Math.min(PER_FRAME, mains - f * PER_FRAME)), actor_kind: 'user', actor_id: session.userId });
          expect(error).toBeNull();
        }
        await instrument(page);
        const cdp = await page.context().newCDPSession(page);
        if (profile === Profile.Phone) {
          await cdp.send('Network.enable');
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: PHONE_CPU });
          await cdp.send('Network.emulateNetworkConditions', FAST_3G);
        }

        const tiles = mains * 2;
        await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
        const cold = await measureOpen(page, tiles);
        await page.getByTestId('project-components').screenshot({ path: `${process.env.THUMBS_SHOTS ?? 'test-results'}/thumbs-${process.env.THUMBS_BUILD}-${profile}-${mains}.png` });
        if (process.env.THUMBS_REOPEN === '0') {
          appendFileSync(OUT, `${JSON.stringify({ build: process.env.THUMBS_BUILD ?? 'unknown', profile, mains, tiles, cold })}\n`);
          return;
        }
        await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
        const reopen = await measureOpen(page, tiles);

        const row = { build: process.env.THUMBS_BUILD ?? 'unknown', profile, mains, tiles, cold, reopen };
        appendFileSync(OUT, `${JSON.stringify(row)}\n`);
        console.log(JSON.stringify(row));
      });
    }
  }
});
