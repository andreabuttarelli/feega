import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, chromium, type CDPSession, type Page } from '@playwright/test';
import { instrument, measure, type Frames } from '../e2e/fixtures/frame-sweeps';
import { LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';
import { ZOOM_FIXTURE_PLACE } from '../../scripts/perf/zoom-fixture.mjs';

enum Gesture {
  Pan = 'pan',
  Zoom = 'zoom'
}

type Step = { dx: number; dy: number; ctrl: boolean };
type Hot = { fn: string; at: string; calls: number; perTick: number };
type Spent = { fn: string; at: string; selfMs: number; perFrameMs?: number };
type GestureRun = { settled: boolean; ticks: number; paints: number; reruns: number; effects: number; deriveds: number; rerunsPerTick: number; hot: Hot[]; spent: Spent[]; jsMs: number; jsPerFrameMs: number; frames: Frames };

const OUT = process.env.BENCH_OUT ?? 'perf-results';
const LABEL = process.env.BENCH_LABEL ?? 'camera';
const VIEWPORT = { width: 1440, height: 900 };
const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
const START_VIEW = { x: -400, y: -150, zoom: 0.08 };
const PLACE = process.env.BENCH_PLACE === 'zoom' ? ZOOM_FIXTURE_PLACE : LANDINGS_FIXTURE_PLACE;
const VIEW_KEY = `feega:viewport:${LOCAL_USER_ID}:${PLACE.canvasId}`;
const FRAME_MS = 1000 / 120;
const TICKS = 240;
const PAN_PX = 4;
const ZOOM_DY = 1;
const CTRL = 2;
const SETTLE_GIVE_UP_MS = 180_000;
const SETTLE_POLL_MS = 500;
const OPEN_GIVE_UP_MS = 600_000;
const QUIET_MS = 1500;
const TOP = 25;
const SNIPPET = 90;
const US_PER_MS = 1000;
const SVELTE_RUNS = { reaction: 'update_reaction', effect: 'update_effect', derived: 'execute_derived' };

const STEPS: Record<Gesture, (i: number) => Step> = {
  [Gesture.Pan]: (i) => ({ dx: PAN_PX * Math.sign(Math.sin((i / TICKS) * 2 * Math.PI) || 1), dy: PAN_PX / 3, ctrl: false }),
  [Gesture.Zoom]: (i) => ({ dx: 0, dy: i < TICKS / 2 ? -ZOOM_DY : ZOOM_DY, ctrl: true })
};

async function play(cdp: CDPSession, gesture: Gesture) {
  const started = performance.now();
  for (let i = 0; i < TICKS; i++) {
    const wait = i * FRAME_MS - (performance.now() - started);
    if (wait > 1) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    const s = STEPS[gesture](i);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: VIEWPORT.width / 2, y: VIEWPORT.height / 2, deltaX: s.dx, deltaY: s.dy, modifiers: s.ctrl ? CTRL : 0 });
  }
}

async function settle(page: Page): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < SETTLE_GIVE_UP_MS) {
    const waiting = await page.locator('[data-testid="core-canvas"]').getAttribute('data-waiting').catch(() => null);
    if (waiting === '0') {
      await page.waitForTimeout(QUIET_MS);
      return true;
    }
    await page.waitForTimeout(SETTLE_POLL_MS);
  }
  return false;
}

type Fn = { functionName: string; ranges: { startOffset: number; count: number }[] };
type Script = { scriptId: string; url: string; functions: Fn[] };

async function sourceOf(cdp: CDPSession, cache: Map<string, string>, scriptId: string) {
  if (!cache.has(scriptId)) {
    cache.set(scriptId, (await cdp.send('Debugger.getScriptSource', { scriptId })).scriptSource);
  }
  return cache.get(scriptId)!;
}

const shortUrl = (url: string) => url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');

async function calls(cdp: CDPSession, scripts: Script[], sources: Map<string, string>) {
  const counted: { fn: string; at: string; calls: number }[] = [];
  for (const s of scripts.filter((s) => /\/src\/|node_modules|deps\//.test(s.url))) {
    for (const f of s.functions.slice(1)) {
      const { startOffset, count } = f.ranges[0];
      if (!count) {
        continue;
      }
      const source = await sourceOf(cdp, sources, s.scriptId);
      const line = source.slice(0, startOffset).split('\n').length;
      counted.push({ fn: f.functionName || source.slice(startOffset, startOffset + SNIPPET).replace(/\s+/g, ' '), at: `${shortUrl(s.url)}:${line}`, calls: count });
    }
  }
  return counted;
}

type Node = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] };

function selfTimes(profile: { nodes: Node[]; samples: number[]; timeDeltas: number[] }): Spent[] {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<string, number>();
  profile.samples.forEach((id, i) => {
    const { functionName, url, lineNumber } = byId.get(id)!.callFrame;
    if (!url) {
      return;
    }
    const key = `${functionName || '(anonymous)'}|${shortUrl(url)}:${lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0) / US_PER_MS);
  });
  return [...self].map(([key, ms]) => ({ fn: key.split('|')[0], at: key.split('|')[1], selfMs: Math.round(ms * 10) / 10 })).sort((a, b) => b.selfMs - a.selfMs);
}

async function counted(page: Page, cdp: CDPSession, gesture: Gesture, sources: Map<string, string>) {
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
  await cdp.send('Profiler.takePreciseCoverage');
  await play(cdp, gesture);
  await page.waitForTimeout(QUIET_MS);
  const { result } = await cdp.send('Profiler.takePreciseCoverage');
  await cdp.send('Profiler.stopPreciseCoverage');
  return calls(cdp, result as Script[], sources);
}

async function profiled(page: Page, cdp: CDPSession, gesture: Gesture) {
  await cdp.send('Profiler.start');
  const frames = await measure(page, TICKS * FRAME_MS, () => play(cdp, gesture));
  const { profile } = await cdp.send('Profiler.stop');
  return { frames, spent: selfTimes(profile as never) };
}

async function run(page: Page, cdp: CDPSession, gesture: Gesture, sources: Map<string, string>): Promise<GestureRun> {
  const settled = await settle(page);
  const counts = await counted(page, cdp, gesture, sources);
  await settle(page);
  const { frames, spent } = await profiled(page, cdp, gesture);
  await settle(page);
  const named = (name: string) => counts.filter((c) => c.fn === name).reduce((sum, c) => sum + c.calls, 0);
  const paints = named('paintOn');
  const reruns = named(SVELTE_RUNS.reaction);
  return {
    settled,
    ticks: TICKS,
    paints,
    reruns,
    effects: named(SVELTE_RUNS.effect),
    deriveds: named(SVELTE_RUNS.derived),
    rerunsPerTick: Math.round((reruns / TICKS) * 10) / 10,
    hot: counts
      .filter((c) => !/node_modules|deps\//.test(c.at))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, TOP)
      .map((c) => ({ ...c, perTick: Math.round((c.calls / TICKS) * 10) / 10 })),
    spent: spent.slice(0, TOP).map((s) => ({ ...s, perFrameMs: Math.round((s.selfMs / Math.max(1, frames.frames)) * 100) / 100 })),
    jsMs: Math.round(spent.reduce((sum, s) => sum + s.selfMs, 0)),
    jsPerFrameMs: Math.round((spent.filter((s) => !s.at.includes('.wasm')).reduce((sum, s) => sum + s.selfMs, 0) / Math.max(1, frames.frames)) * 100) / 100,
    frames
  };
}

test('camera tick: Svelte reruns and main-thread JS per pan and zoom tick', async ({ baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(instrument);
  await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view: START_VIEW });
  page.on('crash', () => console.log(`${LABEL}: page crashed`));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Debugger.enable');
  await cdp.send('Profiler.enable');
  await page.goto(`${baseURL}/p/${PLACE.projectId}/c/${PLACE.canvasId}`, { waitUntil: 'commit' });
  await page.locator('[data-testid="core-canvas"]').first().waitFor({ timeout: OPEN_GIVE_UP_MS });
  await settle(page);
  const frames = Number(await page.locator('[data-testid="core-canvas"]').getAttribute('data-held'));
  const sources = new Map<string, string>();
  const result: Partial<Record<Gesture, GestureRun>> = {};
  for (const gesture of Object.values(Gesture)) {
    result[gesture] = await run(page, cdp, gesture, sources);
    const r = result[gesture]!;
    console.log(`${LABEL} ${gesture}: settled=${r.settled} frames=${frames} ticks=${r.ticks} paints=${r.paints} reruns/tick=${r.rerunsPerTick} effects=${r.effects} deriveds=${r.deriveds} jsMs=${r.jsMs} js/frame=${r.jsPerFrameMs} p95=${r.frames.p95} max=${r.frames.max}`);
    writeFileSync(join(OUT, `camera-tick-${LABEL}.json`), JSON.stringify({ label: LABEL, frames, result }, null, 2));
  }
  await browser.close();
  expect(frames).toBeGreaterThan(0);
});
