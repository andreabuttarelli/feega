import { benchRun, openCanvas, sleep, VIEWPORT } from './machine.mjs';

const FRAME_MS = 1000 / 120;
const WHEEL_ZOOM = 0.01;
const CTRL = 2;
const CENTRE = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
const LEG_MS = 1500;
const SETTLE_MS = 2000;
const LOADED_MAX_MS = 60_000;
const SPLASH_MAX_MS = 60_000;
const AIM_TRIES = 8;
const AIM_PX = 3;
const AIM_LOG = 0.02;
const PRESENTED = new Set(['STATE_PRESENTED_ALL', 'STATE_PRESENTED_PARTIAL']);
const CATEGORIES = ['benchmark', 'cc', 'viz', 'gpu', 'blink.user_timing', 'disabled-by-default-devtools.timeline.frame'];

if (process.argv.includes('--help')) {
  console.log('usage: node scripts/perf/kit/gesture.mjs [--build=<repo root>] [--name=<label>] [--fixture=stress36|posters36|landings|<path>] [--only=<scenario,...>] [--out=<file.jsonl>]');
  process.exit(0);
}

const smooth = (t) => t * t * t * (t * (6 * t - 15) + 10);
const ticks = (ms) => Math.max(1, Math.round(ms / FRAME_MS));

function zoomSteps(from, to, ms) {
  const n = ticks(ms);
  const span = Math.log(to) - Math.log(from);
  return Array.from({ length: n }, (_, i) => ({ ctrl: true, dx: 0, dy: (-span * (smooth((i + 1) / n) - smooth(i / n))) / WHEEL_ZOOM }));
}

function panSteps(dx, dy, ms) {
  const n = ticks(ms);
  return Array.from({ length: n }, (_, i) => {
    const share = smooth((i + 1) / n) - smooth(i / n);
    return { ctrl: false, dx: dx * share, dy: dy * share };
  });
}

const both = (a, b) => a.flatMap((s, i) => [s, ...(b[i] ? [b[i]] : [])]);

async function playWheel(cdp, steps, perTick = 1) {
  const started = performance.now();
  for (const [i, s] of steps.entries()) {
    const wait = Math.floor(i / perTick) * FRAME_MS - (performance.now() - started);
    if (wait > 1) {
      await sleep(wait);
    }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...CENTRE, deltaX: s.dx, deltaY: s.dy, modifiers: s.ctrl ? CTRL : 0 });
  }
}

const readView = (page) => page.$eval('[data-canvas-surface]', (e) => e.dataset.view.split(',').map(Number)).then(([x, y, zoom]) => ({ x, y, zoom }));

async function aim(page, cdp, target) {
  let gain = { zoom: 1, pan: 1 };
  for (let i = 0; i < AIM_TRIES; i++) {
    const now = await readView(page);
    const off = Math.log(target.zoom / now.zoom);
    if (Math.abs(off) > AIM_LOG) {
      await cdp.send('Input.synthesizePinchGesture', { ...CENTRE, scaleFactor: Math.exp(off / gain.zoom), relativeSpeed: 1200 });
      await sleep(300);
      const after = await readView(page);
      const moved = Math.log(after.zoom / now.zoom);
      gain.zoom = Math.abs(moved) > 1e-3 ? Math.min(2, Math.max(0.2, moved / (off / gain.zoom))) : gain.zoom;
      continue;
    }
    const want = { x: CENTRE.x - (CENTRE.x - target.x) * (now.zoom / target.zoom), y: CENTRE.y - (CENTRE.y - target.y) * (now.zoom / target.zoom) };
    const err = { x: want.x - now.x, y: want.y - now.y };
    if (Math.hypot(err.x, err.y) < AIM_PX) {
      return now;
    }
    await cdp.send('Input.synthesizeScrollGesture', { ...CENTRE, xDistance: Math.round(err.x / gain.pan), yDistance: Math.round(err.y / gain.pan), speed: 4000, gestureSourceType: 'mouse' });
    await sleep(300);
    const after = await readView(page);
    const sent = Math.hypot(err.x, err.y) / gain.pan;
    const moved = ((after.x - now.x) * err.x + (after.y - now.y) * err.y) / Math.hypot(err.x, err.y);
    gain.pan = sent > 5 && Math.abs(moved) > 1 ? Math.min(3, Math.max(-3, moved / sent)) : gain.pan;
  }
  return readView(page);
}

async function traced(browser, page, run) {
  const cdp = await browser.newBrowserCDPSession();
  await cdp.send('Tracing.start', { transferMode: 'ReturnAsStream', traceConfig: { includedCategories: CATEGORIES } });
  await page.evaluate(() => performance.mark('bench|start'));
  await run();
  await page.evaluate(() => performance.mark('bench|end'));
  await sleep(300);
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end');
  const { stream } = await done;
  let text = '';
  for (;;) {
    const chunk = await cdp.send('IO.read', { handle: stream, size: 1 << 22 });
    text += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data;
    if (chunk.eof) {
      break;
    }
  }
  await cdp.send('IO.close', { handle: stream });
  await cdp.detach();
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : parsed.traceEvents;
}

export function presented(events) {
  const mark = (name) => events.find((e) => e.name === name && e.cat?.includes('user_timing'))?.ts;
  const [t0, t1] = [mark('bench|start'), mark('bench|end')];
  const reporters = events.filter((e) => e.name === 'PipelineReporter');
  const byPid = new Map();
  for (const e of reporters) {
    byPid.set(e.pid, (byPid.get(e.pid) ?? 0) + 1);
  }
  const renderer = new Set(events.filter((e) => e.ph === 'M' && e.name === 'process_name' && e.args?.name === 'Renderer').map((e) => e.pid));
  const pid = [...byPid].filter(([p]) => renderer.has(p)).sort((a, b) => b[1] - a[1])[0]?.[0];
  const begins = new Map(reporters.filter((e) => e.pid === pid && e.ph === 'b').map((e) => [`${e.id ?? e.id2?.local}`, e]));
  const frames = reporters
    .filter((e) => e.pid === pid && e.ph === 'e')
    .map((e) => ({ at: e.ts, state: begins.get(`${e.id ?? e.id2?.local}`)?.args?.chrome_frame_reporter?.state }))
    .filter((f) => f.at >= t0 && f.at <= t1);
  const shown = frames.filter((f) => PRESENTED.has(f.state)).map((f) => f.at).sort((a, b) => a - b);
  const gaps = shown.slice(1).map((t, i) => (t - shown[i]) / 1000).sort((a, b) => a - b);
  const seconds = (t1 - t0) / 1e6;
  return { fps: Math.round((shown.length / seconds) * 10) / 10, presented: shown.length, dropped: frames.filter((f) => f.state === 'STATE_DROPPED').length, p95GapMs: Math.round(gaps[Math.floor(gaps.length * 0.95)] ?? 0), worstGapMs: Math.round(gaps.at(-1) ?? 0), seconds: Math.round(seconds * 100) / 100 };
}

const until = async (page, test, ms) => {
  const started = Date.now();
  while (Date.now() - started < ms && !(await page.evaluate(test).catch(() => false))) {
    await sleep(100);
  }
};

const loaded = () => performance.getEntriesByName('frame|sharp|all').length > 0;

async function gestures({ opts, base, view }) {
  const { browser, page, cdp, url, close } = await openCanvas(base, view);
  const fit = view.zoom;
  const scenarios = {
    'first-gesture-during-load': { during: true, steps: () => [...panSteps(-800, 0, LEG_MS), ...panSteps(800, 0, LEG_MS)] },
    'zoom-fit-100': { steps: () => [...zoomSteps(fit, 1, LEG_MS), ...zoomSteps(1, fit, LEG_MS)] },
    'zoom-pan': { perTick: 2, steps: () => [...both(zoomSteps(fit, 0.25, LEG_MS), panSteps(-600, -300, LEG_MS)), ...both(zoomSteps(0.25, fit, LEG_MS), panSteps(600, 300, LEG_MS))] },
    'pan-fit': { steps: () => [...panSteps(-900, -300, LEG_MS), ...panSteps(900, 300, LEG_MS)] },
    'pan-50': { at: { zoom: 0.5 }, steps: () => [...panSteps(-1800, -600, LEG_MS), ...panSteps(1800, 600, LEG_MS)] }
  };
  const only = opts.only?.split(',');
  const results = {};
  try {
    await page.goto(url, { waitUntil: 'commit' });
    await until(page, () => window.__bench.splashGone !== null, SPLASH_MAX_MS);
    for (const [name, s] of Object.entries(scenarios)) {
      if (only && !only.includes(name)) {
        continue;
      }
      if (!s.during) {
        await until(page, loaded, LOADED_MAX_MS);
        const target = s.at ? { zoom: s.at.zoom, x: CENTRE.x - (CENTRE.x - view.x) * (s.at.zoom / fit), y: CENTRE.y - (CENTRE.y - view.y) * (s.at.zoom / fit) } : view;
        await aim(page, cdp, target);
        await sleep(SETTLE_MS);
      }
      const before = await readView(page);
      const events = await traced(browser, page, () => playWheel(cdp, s.steps(), s.perTick));
      const after = await readView(page);
      results[name] = { ...presented(events), cameraBefore: before, cameraAfter: after };
      console.error(`${name}: ${JSON.stringify(results[name])}`);
    }
    return { loadedMs: await page.evaluate(() => Math.round(performance.getEntriesByName('frame|sharp|all')[0]?.startTime ?? -1)), scenarios: results };
  } finally {
    await close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await benchRun(gestures);
}
