// ponytail: one page, two engines. mode=native -> Electron addon draws behind a transparent stage;
// mode=web -> gpu-core wasm (WebGPU) draws into a <canvas>, exactly like the feega web canvas.
const params = new URLSearchParams(location.search);
const MODE = window.nativeCanvas ? 'native' : 'web';
const T0 = performance.now();
const $ = (id) => document.getElementById(id);
const stage = $('stage');
document.body.classList.add(MODE);
$('mode').textContent = MODE === 'native' ? 'native Metal (gpu-core)' : 'web WebGPU (gpu-core wasm)';

const cam = { x: 40, y: 40, zoom: 0.08 };
let motion = false;
let selected = null;
const layers = await (await fetch('/layers.json')).json();

// ---- engine adapters: same calls, different backends ----
let engine;
if (MODE === 'native') {
  const r = stage.getBoundingClientRect();
  await window.nativeCanvas.start({ x: r.left, y: r.top, w: r.width, h: r.height });
  engine = {
    camera: () => window.nativeCanvas.setCamera(cam.x, cam.y, cam.zoom),
    motion: (on) => window.nativeCanvas.setMotion(on),
    tick: () => {},
    resize: (r) => window.nativeCanvas.resize({ x: r.left, y: r.top, w: r.width, h: r.height })
  };
} else {
  engine = await webEngine();
}

async function webEngine() {
  const core = await import('/gpu-core/gpu_core.js');
  await core.default();
  const canvas = document.createElement('canvas');
  stage.prepend(canvas);
  const dpr = devicePixelRatio;
  const r = stage.getBoundingClientRect();
  const attached = await core.WebCore.attach(canvas, Math.round(r.width * dpr), Math.round(r.height * dpr));
  const scene = await (await fetch('/bench/scene.json')).json();
  const bitmaps = {};
  for (const [clip, file] of Object.entries(scene.images)) {
    bitmaps[file] ??= await createImageBitmap(await (await fetch('/bench/' + file)).blob());
    attached.picture(clip, bitmaps[file], bitmaps[file].width, bitmaps[file].height);
  }
  for (const [key, list] of Object.entries(scene.groups)) attached.put_group(key, JSON.stringify(list));
  attached.patch_uses(JSON.stringify({ put: scene.uses, drop: [] }));
  const motions = scene.motion;
  const stats = { presents: [], work: [], firstFrameMs: 0, loadMs: performance.now() - T0 };
  window.webStats = stats;
  return {
    camera: () => attached.set_camera(cam.x * dpr, cam.y * dpr, cam.zoom * dpr),
    motion: () => {},
    tick: (now) => {
      if (motion) attached.patch_uses(JSON.stringify({ put: motions.map((m) => ({ kind: 'use', clip: m.clip, group: m.group, matrix: animated(m, now), cache: false })), drop: [] }));
      const t = performance.now();
      const outcome = attached.frame(now).split('\n')[0];
      if (outcome !== 'idle') {
        const t1 = performance.now();
        if (!stats.firstFrameMs) stats.firstFrameMs = t1 - T0;
        stats.presents.push(t1);
        stats.work.push(t1 - t);
      }
    },
    resize: () => {},
    stats: () => {
      const out = { ...stats, presents: stats.presents.splice(0), work: stats.work.splice(0) };
      return out;
    }
  };
}

function animated(m, t) {
  const p = (t / m.period) * Math.PI * 2;
  if (m.anim === 'orbit') return [1, 0, 0, 1, m.x + Math.cos(p) * m.amp, m.y + Math.sin(p) * m.amp];
  if (m.anim === 'pulse') {
    const s = 1 + 0.25 * Math.sin(p);
    return [s, 0, 0, s, m.x, m.y];
  }
  return [1, 0, 0, 1, m.x + Math.sin(p) * m.amp, m.y];
}

const getStats = () => (MODE === 'native' ? JSON.parse(window.nativeCanvas.stats()) : engine.stats());

// ---- UI: layers, selection, properties ----
const list = $('list');
layers.forEach((l, i) => {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span>${l.name}</span><small>${l.items}</small>`;
  row.onclick = () => {
    select(i);
    focusOn(l);
  };
  list.append(row);
});

function select(i) {
  selected = i;
  [...list.children].forEach((r, k) => r.classList.toggle('sel', k === i));
  const l = layers[i];
  $('dl').innerHTML = l ? `<dt>Name</dt><dd>${l.name}</dd><dt>X</dt><dd>${l.x}</dd><dt>Y</dt><dd>${l.y}</dd><dt>W</dt><dd>${l.w}</dd><dt>H</dt><dd>${l.h}</dd><dt>Items</dt><dd>${l.items}</dd>` : '<dt>Selection</dt><dd>none</dd>';
  overlay();
}

function overlay() {
  const el = $('sel');
  const l = layers[selected];
  if (!l) return (el.style.display = 'none');
  Object.assign(el.style, { display: 'block', left: l.x * cam.zoom + cam.x + 'px', top: l.y * cam.zoom + cam.y + 'px', width: l.w * cam.zoom + 'px', height: l.h * cam.zoom + 'px' });
  el.firstChild.textContent = `${l.name}  ${l.w}×${l.h}`;
}

function setCam(x, y, zoom) {
  Object.assign(cam, { x, y, zoom });
  engine.camera();
  overlay();
}

function focusOn(l) {
  const r = stage.getBoundingClientRect();
  const zoom = Math.min((r.width - 80) / l.w, (r.height - 80) / l.h);
  setCam(r.width / 2 - (l.x + l.w / 2) * zoom, r.height / 2 - (l.y + l.h / 2) * zoom, zoom);
}

const world = layers.reduce((a, l) => ({ w: Math.max(a.w, l.x + l.w), h: Math.max(a.h, l.y + l.h) }), { w: 0, h: 0 });
const fit = () => focusOn({ x: 0, y: 0, w: world.w, h: world.h });

let hand = false;
let drag = null;
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey) {
    const k = Math.exp(-e.deltaY * 0.01);
    const z = Math.min(32, Math.max(0.01, cam.zoom * k));
    const px = e.clientX - r.left, py = e.clientY - r.top;
    setCam(px - ((px - cam.x) * z) / cam.zoom, py - ((py - cam.y) * z) / cam.zoom, z);
  } else setCam(cam.x - e.deltaX, cam.y - e.deltaY, cam.zoom);
}, { passive: false });
stage.addEventListener('pointerdown', (e) => {
  if (hand || e.button === 1) {
    drag = { x: e.clientX, y: e.clientY };
    stage.setPointerCapture(e.pointerId);
    return;
  }
  const r = stage.getBoundingClientRect();
  const wx = (e.clientX - r.left - cam.x) / cam.zoom, wy = (e.clientY - r.top - cam.y) / cam.zoom;
  select(layers.findIndex((l) => wx >= l.x && wx <= l.x + l.w && wy >= l.y && wy <= l.y + l.h));
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  setCam(cam.x + e.clientX - drag.x, cam.y + e.clientY - drag.y, cam.zoom);
  drag = { x: e.clientX, y: e.clientY };
});
stage.addEventListener('pointerup', () => (drag = null));
$('tSelect').onclick = () => { hand = false; $('tSelect').classList.add('on'); $('tHand').classList.remove('on'); };
$('tHand').onclick = () => { hand = true; $('tHand').classList.add('on'); $('tSelect').classList.remove('on'); };
$('tFit').onclick = fit;
$('t100').onclick = () => { const r = stage.getBoundingClientRect(); const cx = (r.width / 2 - cam.x) / cam.zoom, cy = (r.height / 2 - cam.y) / cam.zoom; setCam(r.width / 2 - cx, r.height / 2 - cy, 1); };
$('tMotion').onclick = () => { motion = !motion; engine.motion(motion); $('tMotion').classList.toggle('on', motion); };
new ResizeObserver(() => engine.resize(stage.getBoundingClientRect())).observe(stage);

// ---- live fps readout ----
let shown = [];
setInterval(() => {
  if (benching) return;
  const s = getStats();
  shown = shown.concat(s.presents).slice(-240);
  const now = shown[shown.length - 1] ?? 0;
  const last = shown.filter((t) => t > now - 1000);
  $('fps').textContent = `${last.length} fps · first frame ${Math.round(s.firstFrameMs)} ms`;
  if (s.error) console.log("NATIVE ERROR", s.error);
  if (params.has("log")) console.log("FPS", $("fps").textContent);
}, 500);

function loop(now) {
  engine.tick(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
fit();

// ---- bench: scripted camera, identical in both modes (see native-bench/METHOD.md) ----
let benching = false;
const SETTLE_MS = 1000;
const r0 = stage.getBoundingClientRect();
const centreOn = (wx, wy, zoom) => setCam(r0.width / 2 - wx * zoom, r0.height / 2 - wy * zoom, zoom);
const TAU = Math.PI * 2;
const PHASES = [
  { name: 'overview', ms: 2000, at: () => fit() },
  { name: 'pan', ms: 10000, at: (t) => centreOn(12000 + 1600 * Math.sin((TAU * t) / 4000), 2300 + 900 * Math.sin((TAU * t) / 6000), 0.25) },
  { name: 'zoom', ms: 10000, at: (t) => centreOn(720, 700, 0.05 * Math.pow(80, (1 - Math.cos((TAU * t) / 5000)) / 2)) },
  { name: 'motion', ms: 5000, start: () => { motion = true; engine.motion(true); }, at: () => centreOn(1920 + 200 + 960, 9300 + 540, 0.5) }
];
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const frames = () => new Promise((ok) => requestAnimationFrame(ok));

function summarise(name, presents, work, ms) {
  const iv = presents.slice(1).map((t, i) => t - presents[i]).sort((a, b) => a - b);
  const w = [...work].sort((a, b) => a - b);
  const q = (a, p) => (a.length ? +a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(2) : null);
  return { name, fps: +((presents.length * 1000) / ms).toFixed(1), intervalP50: q(iv, 0.5), intervalP95: q(iv, 0.95), intervalMax: q(iv, 1), over16_7Pct: iv.length ? +((100 * iv.filter((x) => x > 16.7).length) / iv.length).toFixed(1) : null, over8_3Pct: iv.length ? +((100 * iv.filter((x) => x > 8.4).length) / iv.length).toFixed(1) : null, workP50: q(w, 0.5), workP95: q(w, 0.95) };
}

async function bench() {
  benching = true;
  const label = params.get('label') || MODE;
  const out = { mode: MODE, label, ua: navigator.userAgent, viewport: [r0.width, r0.height, devicePixelRatio], phases: [] };
  const first = getStats();
  out.firstFrameMs = first.firstFrameMs;
  out.loadMs = first.loadMs;
  for (const p of PHASES) {
    p.at(0);
    await sleep(SETTLE_MS);
    getStats();
    window.benchMark?.(p.name, 'start');
    p.start?.();
    const start = performance.now();
    while (performance.now() - start < p.ms) {
      p.at(performance.now() - start);
      await frames();
    }
    const s = getStats();
    window.benchMark?.(p.name, 'end');
    out.phases.push(summarise(p.name, s.presents, s.work, p.ms));
  }
  motion = false;
  engine.motion(false);
  out.system = (await window.benchSystem?.()) ?? null;
  await fetch('/result?name=' + label, { method: 'POST', body: JSON.stringify(out, null, 2) });
  console.log('BENCH', JSON.stringify(out));
  if (params.has('quit')) window.close();
  benching = false;
  fit();
  return out;
}
$('tBench').onclick = bench;
window.bench = bench;
window.shot = (wx, wy, zoom) => centreOn(wx, wy, zoom);
if (params.has('bench')) setTimeout(bench, 4000);
