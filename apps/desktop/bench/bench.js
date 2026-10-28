import { createCoreNative, rasterOf, pictureKey } from '/engine.js';

addEventListener('error', (e) => fetch('/mark?name=' + encodeURIComponent('error ' + e.message) + '&what=x'));
addEventListener('unhandledrejection', (e) => fetch('/mark?name=' + encodeURIComponent('rejected ' + e.reason) + '&what=x'));
const params = new URLSearchParams(location.search);
const bridge = window.feegaNativeCanvas;
const MODE = bridge ? 'native' : 'web';
const label = params.get('label') || MODE;
const stage = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const status = (text) => (document.getElementById('status').textContent = text);
document.getElementById('mode').textContent = MODE === 'native' ? 'native Metal (gpu-core)' : 'web WebGPU (gpu-core wasm)';

const dpr = devicePixelRatio;
const SETTLE_MS = 1000;
const TAU = Math.PI * 2;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const nextFrame = () => new Promise((ok) => requestAnimationFrame(ok));
const mark = (name, what) => fetch(`/mark?name=${name}&what=${what}`);

const scene = await (await fetch('/scene/scene.json')).json();
const bitmaps = {};
for (const file of new Set(Object.values(scene.images))) {
  bitmaps[file] = await createImageBitmap(await (await fetch('/scene/' + file)).blob());
}
const pictures = (item) => {
  const bitmap = bitmaps[scene.images[pictureKey(item)]];
  return bitmap ? { source: bitmap, size: { width: bitmap.width, height: bitmap.height } } : null;
};

const rect = stage.getBoundingClientRect();
const width = Math.round(rect.width * dpr);
const height = Math.round(rect.height * dpr);
const loadStart = performance.now();

async function makeRaster() {
  if (MODE === 'native') {
    return createCoreNative(canvas, width, height);
  }
  const core = await import('/gpu-core/gpu_core.js');
  await core.default();
  canvas.width = width;
  canvas.height = height;
  return rasterOf(await core.WebCore.attach(canvas, width, height));
}

const raster = await makeRaster();
for (const [key, list] of Object.entries(scene.groups)) {
  raster.putGroup(key, list, pictures);
}
raster.patchUses({ put: scene.uses, drop: [] });

const cam = { x: 40, y: 40, zoom: 0.08 };
let motion = false;
let wantShot = null;
const web = { presents: [], work: [] };
let firstFrameMs = 0;

function animated(m, t) {
  const p = (t / m.period) * TAU;
  if (m.anim === 'orbit') return [1, 0, 0, 1, m.x + Math.cos(p) * m.amp, m.y + Math.sin(p) * m.amp];
  if (m.anim === 'pulse') {
    const s = 1 + 0.25 * Math.sin(p);
    return [s, 0, 0, s, m.x, m.y];
  }
  return [1, 0, 0, 1, m.x + Math.sin(p) * m.amp, m.y];
}

function tick(now) {
  if (motion) {
    raster.patchUses({ put: scene.motion.map((m) => ({ kind: 'use', clip: m.clip, group: m.group, matrix: animated(m, now), cache: false })), drop: [] });
  }
  raster.setCamera(cam.x * dpr, cam.y * dpr, cam.zoom * dpr);
  const t0 = performance.now();
  const { outcome } = raster.frame(now);
  if (wantShot && MODE === 'web') {
    const copy = Object.assign(document.createElement('canvas'), { width, height });
    copy.getContext('2d').drawImage(canvas, 0, 0);
    const name = wantShot;
    wantShot = null;
    copy.toBlob((blob) => fetch(`/shot?name=${name}`, { method: 'POST', body: blob }), 'image/png');
  }
  if (MODE === 'web' && outcome !== 'idle') {
    const t1 = performance.now();
    web.presents.push(t1);
    web.work.push(t1 - t0);
    firstFrameMs ||= t1 - loadStart;
  }
}

let running = true;
(function loop(now) {
  if (running) {
    tick(now);
    requestAnimationFrame(loop);
  }
})(performance.now());

async function drain() {
  if (MODE === 'web') {
    const taken = { presents: web.presents.splice(0), work: web.work.splice(0) };
    return { ...taken, firstFrameMs };
  }
  return JSON.parse(await bridge.stats());
}

const q = (list, p) => { const a = [...list].sort((x, y) => x - y); return a.length ? +a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(2) : null; };

function summarise(name, presents, work, ms) {
  const gaps = presents.slice(1).map((t, i) => t - presents[i]).sort((a, b) => a - b);
  const sorted = [...work].sort((a, b) => a - b);
  const q = (list, p) => (list.length ? +list[Math.min(list.length - 1, Math.floor(list.length * p))].toFixed(2) : null);
  const over = (limit) => (gaps.length ? +((100 * gaps.filter((x) => x > limit).length) / gaps.length).toFixed(1) : null);
  return { name, fps: +((presents.length * 1000) / ms).toFixed(1), intervalP50: q(gaps, 0.5), intervalP95: q(gaps, 0.95), intervalMax: q(gaps, 1), late25Pct: over(25), late40Pct: over(40), workP50: q(sorted, 0.5), workP95: q(sorted, 0.95) };
}

const centreOn = (wx, wy, zoom) => Object.assign(cam, { x: rect.width / 2 - wx * zoom, y: rect.height / 2 - wy * zoom, zoom });
const placed = scene.uses.filter((u) => !u.group.includes('_s') && scene.groups[u.group]);
const world = placed.reduce((a, u) => ({ w: Math.max(a.w, u.matrix[4] + scene.groups[u.group].width), h: Math.max(a.h, u.matrix[5] + scene.groups[u.group].height) }), { w: 0, h: 0 });
const fit = () => centreOn(world.w / 2, world.h / 2, Math.min(rect.width / world.w, rect.height / world.h));

const PHASES = [
  { name: 'overview', ms: 2000, at: () => fit() },
  { name: 'pan', ms: 10000, at: (t) => centreOn(12000 + 1600 * Math.sin((TAU * t) / 4000), 2300 + 900 * Math.sin((TAU * t) / 6000), 0.25) },
  { name: 'zoom', ms: 10000, at: (t) => centreOn(720, 700, 0.05 * Math.pow(80, (1 - Math.cos((TAU * t) / 5000)) / 2)) },
  { name: 'motion', ms: 5000, start: () => (motion = true), at: () => centreOn(2880, 9840, 0.5) }
];

const shotDir = params.get('shots');
async function snap(name) {
  if (MODE === 'native') {
    bridge.snapshot(`${shotDir}/${name}.png`);
    return sleep(400);
  }
  wantShot = name;
  await sleep(400);
}

async function sweep() {
  const start = performance.now();
  const marks = [0.4, 0.7];
  while (performance.now() - start < 900) {
    const k = Math.min(1, (performance.now() - start) / 900);
    centreOn(720, 700, 0.25 * Math.pow(32, k));
    await nextFrame();
    if (marks.length && k >= marks[0]) {
      const name = `sweep${marks.shift()}`;
      wantShot = name;
      if (MODE === 'native') {
        bridge.snapshot(`${shotDir}/${name}.png`);
      }
    }
  }
  await sleep(3000);
  await snap('sweep-rest');
}

async function shots() {
  await sweep();
  for (const zoom of [1, 4, 8]) {
    const from = zoom / 4;
    const start = performance.now();
    let midShot = false;
    while (performance.now() - start < 500) {
      const k = Math.min(1, (performance.now() - start) / 500);
      centreOn(720, 700, from * Math.pow(zoom / from, k));
      await nextFrame();
      if (k > 0.8 && !midShot) {
        midShot = true;
        wantShot = `zoom${zoom}-mid`;
        if (MODE === 'native') {
          bridge.snapshot(`${shotDir}/zoom${zoom}-mid.png`);
        }
      }
    }
    centreOn(720, 700, zoom);
    await nextFrame();
    await snap(`zoom${zoom}-gesture`);
    await sleep(3000);
    await snap(`zoom${zoom}-rest`);
  }
}

status('loading');
fit();
await sleep(4000);
if (shotDir) {
  await shots();
  await fetch('/result?label=' + label, { method: 'POST', body: JSON.stringify({ mode: MODE, label, viewport: [rect.width, rect.height, dpr], phases: [], firstFrameMs: 0 }) });
  throw new Error('shots done');
}
const first = await drain();
const out = { mode: MODE, label, ua: navigator.userAgent, viewport: [rect.width, rect.height, dpr], phases: [], firstFrameMs: first.firstFrameMs, loadMs: performance.now() - loadStart };

for (const phase of PHASES) {
  phase.at(0);
  await sleep(SETTLE_MS);
  await drain();
  status(phase.name);
  await mark(phase.name, 'start');
  phase.start?.();
  const start = performance.now();
  while (performance.now() - start < phase.ms) {
    phase.at(performance.now() - start);
    await nextFrame();
  }
  const taken = await drain();
  await mark(phase.name, 'end');
  out.phases.push({ ...summarise(phase.name, taken.presents, taken.work, phase.ms), latencyP50: q(taken.latency ?? [], 0.5), latencyP95: q(taken.latency ?? [], 0.95) });
}

running = false;
await fetch('/result?label=' + label, { method: 'POST', body: JSON.stringify(out, null, 2) });
status('done');
