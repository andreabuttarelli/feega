import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, type CDPSession, type Page } from 'playwright';
import heavy from '../../tests/e2e/fixtures/heavy-canvas-landings.json' with { type: 'json' };

const flags = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const base = flags.get('base') ?? 'http://localhost:5311';
const engine = flags.get('engine') ?? 'gpu-core';
const landing = (flags.get('landing') ?? 'saas') as 'saas';
const docPath = flags.get('doc') ?? '';
let target = heavy.landings.find((l) => l.key === landing)!.desktop.nodeId;
const seconds = Number(flags.get('seconds') ?? 5);
const profile = flags.has('profile');
const throttle = Number(flags.get('throttle') ?? 1);

const LAUNCH = { channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization', '--enable-unsafe-webgpu'] };
const OPEN_MS = 60_000;
const SWEEP_PERIOD_MS = 2000;
const STEP_MS = 8;
const TOP = 25;
const ZOOM_STEPS = 12;
const PAN_STEPS = 6;
const MIN_TAP_PX = 140;
const CENTRED_PX = 20;
const EDGE_PX = 60;

const wheel = (page: Page, at: { x: number; y: number }, delta: { deltaX?: number; deltaY: number; ctrlKey?: boolean }) =>
  page.evaluate(([at, delta]) => document.elementFromPoint(at.x, at.y)?.dispatchEvent(new WheelEvent('wheel', { clientX: at.x, clientY: at.y, bubbles: true, cancelable: true, ...delta })), [at, delta] as const);

async function openFrame(page: Page, nodeId: string) {
  const node = page.locator(`.svelte-flow__node[data-id="${nodeId}"]`);
  const view = page.viewportSize()!;
  const centre = { x: view.width / 2, y: view.height / 2 };
  let box = (await node.boundingBox())!;
  for (let i = 0; i < PAN_STEPS; i++) {
    const dx = box.x + box.width / 2 - centre.x;
    const dy = box.y + Math.min(box.height, centre.y) / 2 - centre.y;
    if (Math.abs(dx) < CENTRED_PX && Math.abs(dy) < CENTRED_PX) {
      break;
    }
    await wheel(page, centre, { deltaX: dx, deltaY: dy });
    await page.waitForTimeout(600);
    box = (await node.boundingBox())!;
  }
  const at = { x: (Math.max(box.x, EDGE_PX) + box.x + box.width) / 2, y: box.y + Math.min(box.height, centre.y) / 2 };
  for (let i = 0; i < ZOOM_STEPS && box.width < MIN_TAP_PX; i++) {
    await wheel(page, at, { deltaY: -60, ctrlKey: true });
    await page.waitForTimeout(250);
    box = (await node.boundingBox())!;
  }
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(800);
  await page.mouse.dblclick(at.x, at.y);
  await page.getByTestId('motion-editor').waitFor({ timeout: OPEN_MS });
}

type Node = { callFrame: { functionName: string; url: string; lineNumber: number }; hitCount: number; id: number };

function selfTimes(nodes: Node[], samples: number[], deltas: number[]): [string, number][] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const total = new Map<string, number>();
  samples.forEach((id, i) => {
    const n = byId.get(id)!;
    const where = n.callFrame.url.replace(/^.*\/(src|node_modules)\//, '$1/').replace(/\?.*$/, '');
    const key = `${n.callFrame.functionName || '(anon)'} ${where}:${n.callFrame.lineNumber}`;
    total.set(key, (total.get(key) ?? 0) + (deltas[i] ?? 0) / 1000);
  });
  return [...total.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP);
}

const percentile = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0;

async function scrub(page: Page, cdp: CDPSession) {
  const ruler = page.locator('[aria-label="Playhead"]').first();
  const box = (await ruler.boundingBox())!;
  const left = box.x + 260;
  const right = Math.min(box.x + box.width, 1100) - 20;
  const y = box.y + box.height / 2;
  await page.evaluate(() => {
    const w = window as unknown as { __gaps: number[]; __long: number[]; __moves: number; __presents: number };
    w.__gaps = [];
    w.__long = [];
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ entryTypes: ['longtask'] });
    w.__moves = 0;
    w.__presents = 0;
    new MutationObserver(() => (w.__moves += 1)).observe(document.querySelector('[aria-label="Playhead"]')!, { attributes: true, attributeFilter: ['aria-valuenow'] });
    let last = performance.now();
    const tick = (now: number) => {
      w.__gaps.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  if (profile) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await cdp.send('Profiler.start');
  }
  if (flags.has('trace')) {
    await browser.startTracing(page, { path: flags.get('trace')!, categories: ['devtools.timeline', 'toplevel', 'v8', 'blink', 'gpu', 'disabled-by-default-devtools.timeline'] });
  }
  await page.mouse.move(left, y);
  await page.mouse.down();
  const start = Date.now();
  while (Date.now() - start < seconds * 1000) {
    const phase = (((Date.now() - start) / SWEEP_PERIOD_MS) % 1) * 2;
    const share = phase < 1 ? phase : 2 - phase;
    await page.mouse.move(left + (right - left) * share, y);
    await page.waitForTimeout(STEP_MS);
  }
  await page.mouse.up();
  if (flags.has('trace')) {
    await browser.stopTracing();
  }
  const result = await page.evaluate(() => {
    const w = window as unknown as { __gaps: number[]; __long: number[]; __moves: number; __presents: number };
    return { gaps: w.__gaps, long: w.__long, moves: w.__moves, presents: w.__presents };
  });
  const shown = percentile(result.gaps, 0.5) > 0 ? result.gaps : [];
  const shownEngine = await page.evaluate(() => document.querySelector('[data-testid="motion-preview"]')?.getAttribute('data-engine'));
  console.log(`engine=${engine} (shown ${shownEngine}) rAF frames ${shown.length} | p50 ${percentile(shown, 0.5).toFixed(1)} p95 ${percentile(shown, 0.95).toFixed(1)} worst ${Math.max(...shown).toFixed(0)} ms | fps ${(shown.length / seconds).toFixed(1)} | playhead moves ${result.moves} | canvas draws/s ${(result.presents / seconds).toFixed(1)} | long tasks ${result.long.length} (total ${result.long.reduce((a, b) => a + b, 0).toFixed(0)} ms, worst ${Math.max(0, ...result.long).toFixed(0)})`);
  let at = 0;
  const slow = shown.flatMap((g) => {
    at += g;
    return g > 25 ? [`${at.toFixed(0)}ms:${g.toFixed(0)}`] : [];
  });
  console.log('slow frames (time into run : gap)', slow.join(' '));
  if (profile) {
    const { profile: p } = (await cdp.send('Profiler.stop')) as { profile: { nodes: Node[]; samples: number[]; timeDeltas: number[] } };
    console.log(selfTimes(p.nodes, p.samples, p.timeDeltas).map(([k, ms]) => `${ms.toFixed(0).padStart(6)} ms  ${k}`).join('\n'));
  }
}

const db = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
let seeded: string | null = null;
if (docPath) {
  const signed = await db.auth.signInWithPassword({ email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });
  if (signed.error) {
    throw signed.error;
  }
  const canvas = await db.from('canvases').select('org_id').eq('id', heavy.canvasId).single();
  if (canvas.error) {
    throw canvas.error;
  }
  const row = await db.from('nodes').insert({ org_id: canvas.data.org_id, project_id: heavy.projectId, canvas_id: heavy.canvasId, type: 'motion', x: 0, y: -4000, data: { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null }, actor_kind: 'user', actor_id: signed.data.user.id }).select('id').single();
  if (row.error) {
    throw row.error;
  }
  seeded = row.data.id;
  target = row.data.id;
}

const browser = await chromium.launch({ ...LAUNCH, headless: !flags.has('headed') });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await context.addInitScript(() => {
  const w = window as unknown as { __presents: number };
  w.__presents = 0;
  const proto = (window as unknown as { GPUCanvasContext?: { prototype: { getCurrentTexture: () => unknown } } }).GPUCanvasContext?.prototype;
  const original = proto?.getCurrentTexture;
  if (proto && original) {
    proto.getCurrentTexture = function (this: unknown) {
      w.__presents += 1;
      return original.call(this);
    };
  }
});
await context.addInitScript(() => window.self === window.top && localStorage.setItem('feega:tour-seen', '1'));
page.on('console', (m) => (flags.has('logs') || /motion preview/i.test(m.text()) ? console.log('console:', m.text().slice(0, 200)) : undefined));
page.on('pageerror', (e) => console.error('pageerror', e.message.slice(0, 200)));
await page.goto(`${base}/login`);
await page.waitForLoadState('networkidle');
await page.getByPlaceholder('you@yourbrand.com').fill(process.env.E2E_TEST_EMAIL!);
await page.locator('input[type="password"]').fill(process.env.E2E_TEST_PASSWORD!);
const loggedIn = page.waitForResponse((r) => r.url().includes('/login?/login') && r.request().method() === 'POST', { timeout: OPEN_MS });
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await loggedIn;
await page.waitForURL(/\/(app|p\/)/, { timeout: OPEN_MS });
if (seeded) {
  const saved = await page.request.post(`${base}/p/${heavy.projectId}/c/${heavy.canvasId}/motion/${seeded}?/save`, { form: { doc: JSON.stringify(JSON.parse(readFileSync(docPath, 'utf8')).doc ?? JSON.parse(readFileSync(docPath, 'utf8'))), version: '0', summary: 'bench' }, headers: { origin: base } });
  console.log('seeded', seeded, saved.status(), (await saved.text()).slice(0, 160));
}
await page.goto(`${base}/p/${heavy.projectId}/c/${heavy.canvasId}/motion/${target}?engine=${engine}${flags.get('extra') ?? ''}`, { waitUntil: 'load' });
await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 4000 }).catch(() => undefined);
await page.waitForTimeout(8000);
console.log('ruler', await page.locator('[aria-label="Playhead"]').count(), 'editor', await page.getByTestId('motion-editor').count(), 'url', page.url());
if (flags.has('shot')) {
  await page.screenshot({ path: flags.get('shot')! });
}
const cdp = await context.newCDPSession(page);
if (throttle > 1) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
}
try {
  await scrub(page, cdp);
} finally {
  if (seeded) {
    await db.from('nodes').delete().eq('id', seeded);
  }
  await browser.close();
}
