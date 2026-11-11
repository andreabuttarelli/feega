import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test, chromium, webkit, type Browser, type BrowserContext, type Page } from '@playwright/test';
import sharp from 'sharp';
import { instrument, measure, wheelPan, wheelZoom, type Frames } from './fixtures/frame-sweeps';

const FIXTURE = process.env.HEAVY_FIXTURE;
const LABEL = process.env.PROBE_LABEL ?? 'run';
const OUT = process.env.CANVAS_BENCH_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'perf', 'profile-zoom');
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 12_000;
const GESTURE_MS = 4000;
const SAMPLE_MS = 250;
const SHARP_POLL_MS = 60;
const SHARP_GIVE_UP_MS = 15_000;
const BURST_STEPS = 12;
const DEEP_BURSTS = 3;
const MB = 1024 * 1024;
const KB_PER_MB = 1024;
const CHANNEL_TOLERANCE = 2;
const SAMPLING_US = 200;
const VIEW_KEY_PREFIX = 'feega:viewport:';

type View = { x: number; y: number; zoom: number };
type Calls = Record<string, number>;
type Gpu = { calls: Calls; submitCpuMs: number; gpuLagP50: number; gpuLagP95: number; frames: number };
type Row = { browser: string; cpu: number; pan: Frames; zoom: Frames; deep: Frames; sharpMs: number; textureMb: number | null; gpuProcessPeakMb: number | null; gpu: Gpu; phases: Record<string, number> | null };

const PHASES: [string, RegExp][] = [
  ['text', /glyph|skrifa|swash|text::|font|parley|harfrust/i],
  ['filters', /filter|blur|shadow|turbulence|kernel/i],
  ['pictures', /pictures::|picture/i],
  ['display list build', /display_list|vello_encoding|vello::scene|kurbo|peniko|vello::(?!wgpu)|stroke|fragments|groups::|layers::|lod::|world::|scene::/i],
  ['compositor', /compositor|retained|reproject|texture_budget|engine::/i],
  ['JS→WASM (json, glue)', /serde|json|wasm_bindgen|__wbg|passStringToWasm|getStringFromWasm|JSON\./i],
  ['wgpu encode/submit', /wgpu|web_sys|GPU|submit|writeBuffer|writeTexture|createBindGroup|beginRenderPass|setPipeline|dispatch/i],
  ['app JS (svelte, camera, uses)', /\.svelte|canvas|camera|uses|frame|gesture|overlay/i],
  ['GC', /garbage collector/i],
  ['idle/program', /\(idle\)|\(program\)/i]
];

const webkitGpuPids = (): Set<string> =>
  new Set(
    execSync('ps -axo pid=,comm=')
      .toString()
      .split('\n')
      .filter((l) => /WebKit\.GPU/.test(l))
      .map((l) => l.trim().split(/\s+/)[0])
  );

const rssMb = (pids: Set<string>): number =>
  Math.round(
    execSync('ps -axo pid=,rss=')
      .toString()
      .split('\n')
      .map((l) => l.trim().split(/\s+/))
      .filter(([pid]) => pids.has(pid))
      .reduce((sum, [, kb]) => sum + Number(kb) / KB_PER_MB, 0)
  );

const counters = () => {
  type Probe = { counting: boolean; calls: Record<string, number>; submitCpuMs: number; lags: number[] };
  const probe: Probe = { counting: false, calls: {}, submitCpuMs: 0, lags: [] };
  (window as unknown as { __gpuCalls: Probe }).__gpuCalls = probe;
  const wrap = (proto: Record<string, unknown> | undefined, name: string, after?: (self: unknown, started: number) => void) => {
    const original = proto?.[name] as ((...a: unknown[]) => unknown) | undefined;
    if (!proto || !original) {
      return;
    }
    proto[name] = function (this: unknown, ...args: unknown[]) {
      const started = performance.now();
      const result = original.apply(this, args);
      if (probe.counting) {
        probe.calls[name] = (probe.calls[name] ?? 0) + 1;
        after?.(this, started);
      }
      return result;
    };
  };
  const g = window as unknown as Record<string, { prototype: Record<string, unknown> } | undefined>;
  for (const name of ['createBuffer', 'createBindGroup', 'createTexture', 'createCommandEncoder', 'createView']) {
    wrap(g.GPUDevice?.prototype, name);
  }
  wrap(g.GPUTexture?.prototype, 'createView');
  wrap(g.GPUCommandEncoder?.prototype, 'beginRenderPass');
  wrap(g.GPUCommandEncoder?.prototype, 'beginComputePass');
  wrap(g.GPUQueue?.prototype, 'writeBuffer');
  wrap(g.GPUQueue?.prototype, 'writeTexture');
  wrap(g.GPUQueue?.prototype, 'submit', (queue, started) => {
    probe.submitCpuMs += performance.now() - started;
    const sent = performance.now();
    (queue as { onSubmittedWorkDone: () => Promise<void> }).onSubmittedWorkDone().then(() => probe.lags.push(performance.now() - sent));
  });
};

const pinView = ({ canvasId, view }: { canvasId: string; view: View }) => {
  const read = Storage.prototype.getItem;
  Storage.prototype.getItem = function (this: Storage, key: string) {
    return key.startsWith('feega:viewport:') && key.endsWith(canvasId) ? JSON.stringify(view) : read.call(this, key);
  };
};

async function login(page: Page, base: string) {
  await page.goto(`${base}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

const shot = (page: Page) => page.screenshot({ clip: { x: 0, y: 0, ...VIEWPORT } });

async function untilSharp(page: Page): Promise<number> {
  const started = Date.now();
  let last = await shot(page);
  while (Date.now() - started < SHARP_GIVE_UP_MS) {
    await page.waitForTimeout(SHARP_POLL_MS);
    const next = await shot(page);
    if (next.equals(last)) {
      return Date.now() - started;
    }
    last = next;
  }
  return SHARP_GIVE_UP_MS;
}

async function burst(page: Page) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; i < BURST_STEPS; i++) {
    await page.mouse.wheel(0, -60);
  }
  await page.keyboard.up('Control');
}

async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'commit' });
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8000 }).catch(() => {});
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(SETTLE_MS);
}

async function storedView(page: Page, canvasId: string): Promise<View | null> {
  return page.evaluate(
    ({ prefix, canvasId }) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith(prefix) && k.endsWith(canvasId));
      return key ? JSON.parse(localStorage.getItem(key)!) : null;
    },
    { prefix: VIEW_KEY_PREFIX, canvasId }
  );
}

function phasesOf(profile: { nodes: { id: number; callFrame: { functionName: string; url: string } }[]; samples: number[]; timeDeltas: number[] }): Record<string, number> {
  const byId = new Map(profile.nodes.map((n) => [n.id, `${n.callFrame.functionName} ${n.callFrame.url}`]));
  const totals: Record<string, number> = {};
  profile.samples.forEach((id, i) => {
    const name = byId.get(id) ?? '';
    const phase = PHASES.find(([, re]) => re.test(name))?.[0] ?? 'other';
    totals[phase] = (totals[phase] ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000;
  });
  return totals;
}

async function gpuOf(page: Page, frames: number): Promise<Gpu> {
  const raw = await page.evaluate(() => {
    const p = (window as unknown as { __gpuCalls: { counting: boolean; calls: Record<string, number>; submitCpuMs: number; lags: number[] } }).__gpuCalls;
    p.counting = false;
    return { calls: p.calls, submitCpuMs: p.submitCpuMs, lags: [...p.lags].sort((a, b) => a - b) };
  });
  const at = (share: number) => Math.round((raw.lags[Math.min(raw.lags.length - 1, Math.floor(raw.lags.length * share))] ?? 0) * 10) / 10;
  const perFrame = Object.fromEntries(Object.entries(raw.calls).map(([k, v]) => [k, Math.round((v / Math.max(1, frames)) * 10) / 10]));
  return { calls: perFrame, submitCpuMs: Math.round((raw.submitCpuMs / Math.max(1, frames)) * 100) / 100, gpuLagP50: at(0.5), gpuLagP95: at(0.95), frames };
}

async function startCounting(page: Page) {
  await page.evaluate(() => Object.assign((window as unknown as { __gpuCalls: object }).__gpuCalls, { counting: true, calls: {}, submitCpuMs: 0, lags: [] }));
}

async function run(browser: Browser, name: string, cpu: number, base: string, url: string, view: View | null, canvasId: string, gpuPids: () => Set<string>): Promise<Row> {
  const context: BrowserContext = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await login(page, base);
  await page.addInitScript(instrument);
  await page.addInitScript(counters);
  if (view) {
    await page.addInitScript(pinView, { canvasId, view });
  }
  await page.addInitScript(() => {
    const peaks = { bytes: 0 };
    (window as unknown as { __peaks: typeof peaks }).__peaks = peaks;
    setInterval(() => {
      const probe = (window as unknown as Record<symbol, { textureBytes: number } | undefined>)[Symbol.for('feega.gpu-probe')];
      peaks.bytes = Math.max(peaks.bytes, probe?.textureBytes ?? 0);
    }, 100);
  });
  if (cpu > 1 && name === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  let peak = 0;
  const pids = gpuPids();
  const sampler = setInterval(() => (peak = Math.max(peak, rssMb(pids))), SAMPLE_MS);
  const tag = `${LABEL}-${name}-cpu${cpu}`;

  await open(page, url);
  if (!view) {
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height - 40);
    await page.keyboard.press('Shift+1');
    await page.waitForTimeout(SETTLE_MS);
    console.log(`fit view ${JSON.stringify(await storedView(page, canvasId))}`);
  }
  writeFileSync(join(OUT, `${tag}-settled.png`), await shot(page));

  await burst(page);
  writeFileSync(join(OUT, `${tag}-midzoom.png`), await shot(page));
  const sharpMs = await untilSharp(page);
  writeFileSync(join(OUT, `${tag}-zoomed-settled.png`), await shot(page));
  for (let i = 1; i < DEEP_BURSTS; i++) {
    await burst(page);
  }
  await page.waitForTimeout(SETTLE_MS);
  const deep = await measure(page, GESTURE_MS, (until) => wheelZoom(page, until));

  await open(page, url);
  await startCounting(page);
  const profiler = name === 'chromium' ? await context.newCDPSession(page) : null;
  if (profiler) {
    await profiler.send('Profiler.enable');
    await profiler.send('Profiler.setSamplingInterval', { interval: SAMPLING_US });
    await profiler.send('Profiler.start');
  }
  const zoom = await measure(page, GESTURE_MS, (until) => wheelZoom(page, until));
  const profile = profiler ? (await profiler.send('Profiler.stop')).profile : null;
  if (profile) {
    writeFileSync(join(OUT, `${tag}-zoom.cpuprofile`), JSON.stringify(profile));
  }
  const phases = profile ? phasesOf(profile as never) : null;
  const gpu = await gpuOf(page, zoom.frames);
  const pan = await measure(page, GESTURE_MS, (until) => wheelPan(page, until));

  const textureBytes = await page.evaluate(() => (window as unknown as { __peaks: { bytes: number } }).__peaks.bytes);
  clearInterval(sampler);
  await context.close();
  return { browser: name, cpu, pan, zoom, deep, sharpMs, textureMb: textureBytes ? Math.round(textureBytes / MB) : null, gpuProcessPeakMb: pids.size ? peak : null, gpu, phases };
}

async function differing(a: string, b: string): Promise<number> {
  const [x, y] = await Promise.all([a, b].map((f) => sharp(f).ensureAlpha().raw().toBuffer()));
  if (x.length !== y.length) {
    return 1;
  }
  let off = 0;
  for (let i = 0; i < x.length; i += 4) {
    if ([0, 1, 2, 3].some((c) => Math.abs(x[i + c] - y[i + c]) > CHANNEL_TOLERANCE)) {
      off += 1;
    }
  }
  return off / (x.length / 4);
}

const engineName = (r: Row) => `${r.browser} ${r.cpu === 1 ? 'desktop' : `${r.cpu}x`}`;

const row = (r: Row) => `| ${engineName(r)} | ${r.zoom.fpsAvg} | ${r.deep.fpsAvg} | ${r.pan.fpsAvg} | ${Math.max(r.zoom.max, r.pan.max)} | ${r.zoom.p95} | ${r.zoom.workP95} | ${r.sharpMs} | ${r.textureMb ?? 'n/a'} | ${r.gpuProcessPeakMb ?? 'n/a'} |`;

const gpuRow = (r: Row) => `| ${engineName(r)} | ${r.gpu.frames} | ${r.gpu.submitCpuMs} | ${r.gpu.gpuLagP50} / ${r.gpu.gpuLagP95} | ${Object.entries(r.gpu.calls).map(([k, v]) => `${k} ${v}`).join(', ')} |`;

const phaseRow = (r: Row) => {
  const total = Object.entries(r.phases ?? {}).filter(([k]) => k !== 'idle/program').reduce((s, [, v]) => s + v, 0);
  const share = (k: string) => `${Math.round(((r.phases?.[k] ?? 0) / Math.max(1, total)) * 100)}%`;
  return `| ${engineName(r)} | ${Math.round(total)} | ${[...PHASES.map(([k]) => k).filter((k) => k !== 'idle/program'), 'other'].map(share).join(' | ')} |`;
};

test.describe('canvas zoom profile @real', () => {
  test.skip(!FIXTURE || !process.env.E2E_TEST_EMAIL, 'needs HEAVY_FIXTURE and the test account');
  test.setTimeout(1_800_000);

  test('profiles zoom on the heavy canvas from a pinned camera', async ({ baseURL }) => {
    mkdirSync(OUT, { recursive: true });
    const fixture = JSON.parse(readFileSync(FIXTURE!, 'utf8')) as { projectId: string; canvasId: string };
    const url = `${baseURL}/p/${fixture.projectId}/c/${fixture.canvasId}`;
    const view: View | null = process.env.PROBE_VIEW ? JSON.parse(process.env.PROBE_VIEW) : null;
    const engines = (process.env.PROBE_ENGINES ?? 'chromium,webkit').split(',');
    const cpus = (process.env.PROBE_CPUS ?? '1,4').split(',').map(Number);
    const rows: Row[] = [];
    if (engines.includes('chromium')) {
      const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--enable-precise-memory-info'] });
      for (const cpu of cpus) {
        rows.push(await run(browser, 'chromium', cpu, baseURL!, url, view, fixture.canvasId, () => new Set()));
      }
      await browser.close();
    }
    if (engines.includes('webkit')) {
      const before = webkitGpuPids();
      const browser = await webkit.launch({ headless: false });
      rows.push(await run(browser, 'webkit', 1, baseURL!, url, view, fixture.canvasId, () => new Set([...webkitGpuPids()].filter((p) => !before.has(p)))));
      await browser.close();
    }
    const diffs: string[] = [];
    const against = process.env.PROBE_AGAINST;
    for (const r of against ? rows : []) {
      for (const shotName of ['settled', 'zoomed-settled']) {
        const share = await differing(join(OUT, `${against}-${r.browser}-cpu${r.cpu}-${shotName}.png`), join(OUT, `${LABEL}-${r.browser}-cpu${r.cpu}-${shotName}.png`));
        diffs.push(`| ${engineName(r)} | ${shotName} | ${(share * 100).toFixed(3)}% |`);
      }
    }
    const text = [
      '| engine | zoom fps | zoomed-in zoom fps | pan fps | worst ms | zoom p95 ms | zoom work p95 ms | time-to-sharp ms | texture peak MB | WebKit GPU MB |',
      '|---|---|---|---|---|---|---|---|---|---|',
      ...rows.map(row),
      '',
      '| engine | zoom frames | submit CPU ms/frame | GPU lag p50/p95 ms | GPU calls per frame |',
      '|---|---|---|---|---|',
      ...rows.map(gpuRow),
      '',
      `| engine | CPU ms sampled | ${[...PHASES.map(([k]) => k).filter((k) => k !== 'idle/program'), 'other'].join(' | ')} |`,
      `|---|---|${[...PHASES, ['other']].slice(1).map(() => '---|').join('')}`,
      ...rows.filter((r) => r.phases).map(phaseRow),
      '',
      '| run | view | pixels off vs ' + (against ?? '-') + ' |',
      '|---|---|---|',
      ...diffs
    ].join('\n');
    writeFileSync(join(OUT, `${LABEL}.md`), text);
    writeFileSync(join(OUT, `${LABEL}.json`), JSON.stringify(rows, null, 2));
    console.log(text);
  });
});
