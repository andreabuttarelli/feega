import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { localEnv } from '../../local.mjs';
import { fixtureCopy } from '../fixture-copy.mjs';
import { LANDINGS_FIXTURE_PLACE } from '../landings-fixture.mjs';

export const PERF_DIR = join(homedir(), 'Documents/feega-videos/perf');
export const FIXTURES = {
  stress36: join(PERF_DIR, 'stress36/stress36.feega'),
  posters36: join(PERF_DIR, 'stress36/posters36.feega'),
  landings: join(PERF_DIR, 'landings/landings.feega')
};
export const LOCK = join(PERF_DIR, '.bench.lock');
export const KIT_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
export const VIEWPORT = { width: 1440, height: 900 };

const MIN_BATTERY = 30;
const MAX_LOAD = 9;
const STALE_MS = 30 * 60_000;
const RECHECK_MS = 15_000;
const SERVER_UP_MS = 90_000;
const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
const FIT_MARGIN = 0.95;
const BROWSER_ARGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--feega-bench'];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function flags(argv = process.argv.slice(2)) {
  return Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')).map(([k, ...v]) => [k, v.length ? v.join('=') : 'true']));
}

export const fixturePath = (name = 'stress36') => FIXTURES[name] ?? resolve(name);

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

export function benchChromiums() {
  const lines = sh('ps -axo pid=,command=').split('\n');
  return lines.filter((l) => /ms-playwright\/chromium-\d+\//.test(l) && !/--type=/.test(l)).map((l) => Number(l.trim().split(/\s+/)[0]));
}

export function machine() {
  const batt = sh('pmset -g batt');
  const lowPower = /lowpowermode\s+1/.test(sh('pmset -g'));
  const load1 = Number(sh('sysctl -n vm.loadavg').trim().replace(/[{}]/g, '').trim().split(/\s+/)[0]);
  return { ac: /AC Power/.test(batt), battery: Number(/(\d+)%/.exec(batt)?.[1] ?? 100), lowPower, load1, chromiums: benchChromiums().length };
}

export function why(m) {
  return [!m.ac && m.battery < MIN_BATTERY && `battery ${m.battery}% on battery`, m.lowPower && 'Low Power Mode on', m.load1 >= MAX_LOAD && `load ${m.load1}`, m.chromiums && `${m.chromiums} benchmark Chromium running`].filter(Boolean);
}

function lockAge() {
  try {
    return Date.now() - statSync(LOCK).mtimeMs;
  } catch {
    return null;
  }
}

function takeLock() {
  try {
    mkdirSync(LOCK);
    writeFileSync(join(LOCK, 'owner'), `${process.pid} ${new Date().toISOString()} ${process.argv.slice(1).join(' ')}\n`);
    return true;
  } catch {
    const age = lockAge();
    if (age !== null && age > STALE_MS && benchChromiums().length === 0) {
      console.error(`bench: lock stale (${Math.round(age / 60_000)} min, no benchmark Chromium), clearing`);
      rmSync(LOCK, { recursive: true, force: true });
    }
    return false;
  }
}

export const releaseLock = () => rmSync(LOCK, { recursive: true, force: true });

export async function gate() {
  for (;;) {
    const m = machine();
    const blocked = why(m);
    if (!blocked.length && takeLock()) {
      const again = machine();
      if (!why(again).length) {
        console.error(`bench: gate open ${JSON.stringify(again)}`);
        return again;
      }
      releaseLock();
    }
    console.error(`bench: waiting — ${blocked.length ? blocked.join(', ') : `lock held: ${readFileSync(join(LOCK, 'owner'), 'utf8').trim()}`}`);
    await sleep(RECHECK_MS);
  }
}

const freePort = () =>
  new Promise((done) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => done(port));
    });
  });

export async function serve(root, fixture) {
  const { file, dispose } = fixtureCopy(fixture);
  const port = await freePort();
  const server = spawn(process.execPath, [join(root, 'scripts/node-server.mjs')], { cwd: root, stdio: 'ignore', env: localEnv(file, String(port)) });
  const base = `http://127.0.0.1:${port}`;
  const stop = () => {
    server.kill();
    dispose();
  };
  const started = Date.now();
  while (Date.now() - started < SERVER_UP_MS) {
    if (await fetch(`${base}/favicon-16.png`).then((r) => r.ok).catch(() => false)) {
      return { base, stop };
    }
    await sleep(250);
  }
  stop();
  throw new Error(`server for ${root} never came up`);
}

export function fitView(fixture) {
  const { nodes } = JSON.parse(strFromU8(unzipSync(readFileSync(fixture), { filter: (f) => f.name === 'canvas.json' })['canvas.json']));
  const left = Math.min(...nodes.map((n) => n.position.x));
  const top = Math.min(...nodes.map((n) => n.position.y));
  const right = Math.max(...nodes.map((n) => n.position.x + n.size.width));
  const bottom = Math.max(...nodes.map((n) => n.position.y + n.size.height));
  const zoom = FIT_MARGIN * Math.min(VIEWPORT.width / (right - left), VIEWPORT.height / (bottom - top));
  return { x: VIEWPORT.width / 2 - ((left + right) / 2) * zoom, y: VIEWPORT.height / 2 - ((top + bottom) / 2) * zoom, zoom };
}

export async function openCanvas(base, view) {
  const browser = await chromium.launch({ headless: false, args: BROWSER_ARGS });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const key = `feega:viewport:${LOCAL_USER_ID}:${LANDINGS_FIXTURE_PLACE.canvasId}`;
  await context.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key, view });
  await context.addInitScript(() => {
    const bench = (window.__bench = { splashGone: null });
    const tick = () => {
      const splash = document.getElementById('canvas-splash');
      const shown = (splash && !splash.hidden) || document.querySelector('[data-testid="canvas-loading"]');
      if (!shown && document.querySelector('[data-canvas-surface]')) {
        bench.splashGone = performance.now();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const url = `${base}/p/${LANDINGS_FIXTURE_PLACE.projectId}/c/${LANDINGS_FIXTURE_PLACE.canvasId}`;
  return { browser, context, page, cdp, url, close: () => browser.close() };
}

export async function benchRun(fn) {
  const opts = flags();
  const root = resolve(opts.build ?? KIT_ROOT);
  const fixture = fixturePath(opts.fixture);
  const m = await gate();
  let served = null;
  try {
    served = await serve(root, fixture);
    const result = await fn({ opts, base: served.base, fixture, view: fitView(fixture) });
    const line = JSON.stringify({ tool: fn.name, build: opts.name ?? root, fixture, machine: m, at: new Date().toISOString(), ...result });
    if (opts.out) {
      writeFileSync(opts.out, `${line}\n`, { flag: 'a' });
    }
    console.log(line);
  } finally {
    served?.stop();
    releaseLock();
  }
}
