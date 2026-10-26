import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';
import { instrument, measure, wheelPan, wheelZoom, type Frames } from './fixtures/frame-sweeps';
import { landingDoc } from './fixtures/landing-frame-doc';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const FRAME_COUNT = 200;
const COLUMNS = 20;
const STEP = { x: 900, y: 560 };
const LANDING_SIZE = { width: 1440, height: 4734 };
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const LANDING_DATA = { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const CPU_SLOWDOWNS = [1, 4];
const VIEWPORT = { width: 1440, height: 900 };
const GESTURE_MS = 3000;
const SETTLE_MS = 2500;
const SELECT_SAMPLES = 3;
const SELECT_DEADLINE_MS = 3000;
const OUT = process.env.CANVAS_BENCH_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'perf');
const SURFACE = '[data-canvas-surface]';

type Selection = { kind: 'frame' | 'none'; ms: number };
type Row = { cpu: number; firstPaintMs: number; pan: Frames; zoom: Frames; selections: Selection[] };

const centreOf = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const landed = (r: Row, kind: Selection['kind']) => r.selections.filter((s) => s.kind === kind).map((s) => s.ms);
const ms = (xs: number[]) => (xs.length ? String(Math.round(median(xs))) : 'n/a');

async function seedFrames(session: E2eSession, admin: SupabaseClient): Promise<void> {
  const base = { org_id: session.orgId, project_id: session.projectId, canvas_id: session.canvasId, actor_kind: 'user', actor_id: session.userId };
  const frames = Array.from({ length: FRAME_COUNT - 1 }, (_, i) => ({ ...base, id: randomUUID(), type: 'motion', x: (i % COLUMNS) * STEP.x, y: Math.floor(i / COLUMNS) * STEP.y, data: LANDSCAPE }));
  const landing = { ...base, id: randomUUID(), type: 'motion', x: 0, y: Math.ceil(FRAME_COUNT / COLUMNS) * STEP.y, data: LANDING_DATA, ...LANDING_SIZE };
  const rows = [...frames, landing];
  expect((await admin.from('nodes').insert(rows)).error).toBeNull();
  const revisions = rows.map((r) => ({ org_id: session.orgId, node_id: r.id, version: 1, doc: r === landing ? landingDoc : doc, actor_kind: 'user', actor_id: session.userId }));
  expect((await admin.from('motion_revisions').insert(revisions)).error).toBeNull();
}

function table(rows: Row[]): string {
  const head = '| CPU | first paint ms | pan fps avg | pan frame p95 ms | pan >33 ms | zoom fps avg | zoom frame p95 ms | zoom >33 ms | frame select median ms | select misses |\n|---|---|---|---|---|---|---|---|---|---|';
  const body = rows.map((r) => `| ${r.cpu === 1 ? 'desktop' : `${r.cpu}x throttle`} | ${r.firstPaintMs} | ${r.pan.fpsAvg} | ${r.pan.p95} | ${r.pan.over33} | ${r.zoom.fpsAvg} | ${r.zoom.p95} | ${r.zoom.over33} | ${ms(landed(r, 'frame'))} | ${landed(r, 'none').length}/${r.selections.length} |`);
  return [head, ...body].join('\n');
}

async function sampleSelection(page: Page, url: string): Promise<Selection> {
  await page.goto(url, { waitUntil: 'commit' });
  await page.locator(SURFACE).first().waitFor();
  await page.waitForTimeout(SETTLE_MS);
  const tile = page.locator('[data-testid="gpu-node"]').first();
  const at = centreOf((await tile.boundingBox())!);
  return clickToSelection(page, at);
}

async function clickToSelection(page: Page, at: { x: number; y: number }): Promise<Selection> {
  await page.evaluate((deadline) => {
    const w = window as unknown as { __selected: Promise<Selection> };
    w.__selected = new Promise<Selection>((resolve) => {
      const watch = (start: number) => {
        const tick = () => {
          const elapsed = performance.now() - start;
          if (document.querySelector('[data-testid="frame-selection"]')) {
            return resolve({ kind: 'frame', ms: elapsed });
          }
          elapsed > deadline ? resolve({ kind: 'none', ms: elapsed }) : requestAnimationFrame(tick);
        };
        tick();
      };
      addEventListener('pointerdown', (e) => watch(e.timeStamp), { once: true, capture: true });
    });
  }, SELECT_DEADLINE_MS);
  await page.mouse.click(at.x, at.y);
  return page.evaluate(() => (window as unknown as { __selected: Promise<Selection> }).__selected);
}

test.describe('canvas bench: 200 frames incl. a landing page @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(240_000);

  test('first paint, pan/zoom frame times, select latency', async ({ page, session, admin }) => {
    await page.setViewportSize(VIEWPORT);
    await seedFrames(session, admin);
    await page.addInitScript(instrument);
    const client = await page.context().newCDPSession(page);
    const rows: Row[] = [];
    const canvasUrl = `/p/${session.projectId}/c/${session.canvasId}`;
    await gotoHydrated(page, canvasUrl);

    for (const cpu of CPU_SLOWDOWNS) {
      await client.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      const started = Date.now();
      await page.goto(canvasUrl, { waitUntil: 'commit' });
      await page.locator(SURFACE).first().waitFor();
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const firstPaintMs = Date.now() - started;
      await page.waitForTimeout(SETTLE_MS);

      const pan = await measure(page, GESTURE_MS, (until) => wheelPan(page, until));
      const zoom = await measure(page, GESTURE_MS, (until) => wheelZoom(page, until));
      await page.waitForTimeout(SETTLE_MS);

      const selections: Selection[] = [];
      for (let i = 0; i < SELECT_SAMPLES; i++) {
        selections.push(await sampleSelection(page, canvasUrl));
      }
      console.log(`[bench] cpu=${cpu} paint=${firstPaintMs} pan=${pan.fpsAvg}fps zoom=${zoom.fpsAvg}fps selections=${JSON.stringify(selections)}`);
      rows.push({ cpu, firstPaintMs, pan, zoom, selections });
    }

    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const out = `# Canvas bench, ${FRAME_COUNT} frames incl. a ${LANDING_SIZE.width}x${LANDING_SIZE.height} landing page\n\n${table(rows)}\n`;
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `canvas-bench-${new Date().toISOString().slice(0, 10)}.md`), out);
    console.log(out);
    expect(rows.every((r) => r.selections.some((s) => s.kind !== 'none')), 'selection never appeared').toBe(true);
  });
});
