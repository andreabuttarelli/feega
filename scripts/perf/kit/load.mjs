import sharp from 'sharp';
import { VIEWPORT, benchRun, openCanvas } from './machine.mjs';

const SHOTS_S = [1, 3, 5, 10, 20, 30];
const NTH_DRAWN = 6;
const INK_INSET = 0.15;
const INK_MIN_PX = 12;
const INK_SHARE = 0.005;
const NEAR = 24;
const CHROME = { left: 60, top: 60, right: VIEWPORT.width - 60, bottom: VIEWPORT.height - 80 };
const STAND_INS = /^(placeholder|\[)|:(placeholder|\[)/;

if (process.argv.includes('--help')) {
  console.log('usage: node scripts/perf/kit/load.mjs [--build=<repo root>] [--name=<label>] [--fixture=stress36|posters36|landings|<path>] [--out=<file.jsonl>]');
  process.exit(0);
}

async function onScreenFrames(page) {
  const boxes = await page.locator('[data-testid="gpu-node"]').evaluateAll((els) => els.map((e) => ({ id: e.dataset.id ?? '', r: e.getBoundingClientRect().toJSON() })));
  return boxes.flatMap(({ id, r }) => {
    const x = Math.max(CHROME.left, Math.round(r.x + r.width * INK_INSET));
    const y = Math.max(CHROME.top, Math.round(r.y + r.height * INK_INSET));
    const width = Math.min(CHROME.right, Math.round(r.x + r.width * (1 - INK_INSET))) - x;
    const height = Math.min(CHROME.bottom, Math.round(r.y + r.height * (1 - INK_INSET))) - y;
    return width > INK_MIN_PX && height > INK_MIN_PX ? [{ id, x, y, width, height }] : [];
  });
}

async function paperOf(png) {
  const { data } = await sharp(png).resize(32, 32, { kernel: 'nearest' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const k = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
}

async function blankFrames(page) {
  const png = await page.screenshot();
  const scale = (await sharp(png).metadata()).width / VIEWPORT.width;
  const paper = await paperOf(png);
  const near = (d, i, c) => Math.abs(d[i] - c[0]) < NEAR && Math.abs(d[i + 1] - c[1]) < NEAR && Math.abs(d[i + 2] - c[2]) < NEAR;
  const frames = await onScreenFrames(page);
  let blank = 0;
  for (const f of frames) {
    const region = { left: Math.round(f.x * scale), top: Math.round(f.y * scale), width: Math.round(f.width * scale), height: Math.round(f.height * scale) };
    const { data } = await sharp(png).extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let ink = 0;
    for (let i = 0; i < data.length; i += 3) {
      ink += near(data, i, [255, 255, 255]) || near(data, i, paper) ? 0 : 1;
    }
    blank += ink / (data.length / 3) < INK_SHARE ? 1 : 0;
  }
  return { blank, onScreen: frames.length };
}

function frameMarks(marks) {
  const frames = {};
  const all = {};
  for (const m of marks.filter((m) => m.name.startsWith('frame|'))) {
    const [, step, group = ''] = m.name.split('|');
    if (group === 'all') {
      all[step] ??= Math.round(m.startTime);
      continue;
    }
    if (STAND_INS.test(group)) {
      continue;
    }
    const id = group.split(':').slice(0, group.includes('@bp:') ? 2 : 1).join(':');
    frames[id] ??= {};
    frames[id][step] ??= Math.round(m.startTime);
  }
  return { frames, all };
}

function pictureLog(cdp) {
  const seen = new Map();
  let origin = null;
  cdp.on('Network.requestWillBeSent', (e) => {
    origin ??= e.type === 'Document' ? e.timestamp : null;
    seen.set(e.requestId, { start: e.timestamp });
  });
  cdp.on('Network.responseReceived', (e) => {
    const r = seen.get(e.requestId);
    if (r && e.response.mimeType.startsWith('image/')) {
      r.image = true;
    }
  });
  cdp.on('Network.loadingFinished', (e) => {
    const r = seen.get(e.requestId);
    if (r) {
      Object.assign(r, { end: e.timestamp, bytes: e.encodedDataLength });
    }
  });
  return () => {
    const images = [...seen.values()].filter((r) => r.image && r.end);
    const at = (t) => Math.round((t - origin) * 1000);
    return images.length ? { count: images.length, bytes: images.reduce((n, r) => n + r.bytes, 0), firstStart: Math.min(...images.map((r) => at(r.start))), lastEnd: Math.max(...images.map((r) => at(r.end))) } : { count: 0 };
  };
}

async function coldLoad({ base, view }) {
  const { page, cdp, url, close } = await openCanvas(base, view);
  try {
    await cdp.send('Network.enable');
    const pictures = pictureLog(cdp);
    const from = Date.now();
    await page.goto(url, { waitUntil: 'commit' });
    const blankAt = {};
    for (const s of SHOTS_S) {
      await page.waitForTimeout(Math.max(0, s * 1000 - (Date.now() - from)));
      blankAt[`${s}s`] = await blankFrames(page).catch((e) => ({ error: String(e).slice(0, 120) }));
    }
    const { marks, splashGone } = await page.evaluate(() => ({ marks: performance.getEntriesByType('mark').map((m) => ({ name: m.name, startTime: m.startTime })), splashGone: window.__bench.splashGone }));
    const { frames, all } = frameMarks(marks);
    const drawn = Object.values(frames).map((f) => f.drawn).filter((t) => t !== undefined).sort((a, b) => a - b);
    return {
      splashGoneMs: splashGone === null ? null : Math.round(splashGone),
      firstDrawnMs: drawn[0] ?? null,
      sixthDrawnMs: drawn[NTH_DRAWN - 1] ?? null,
      drawnFrames: drawn.length,
      allVectorsMs: all['all-vectors'] ?? null,
      sharpMs: all.sharp ?? null,
      pictures: pictures(),
      blankAt,
      frames
    };
  } finally {
    await close();
  }
}

await benchRun(coldLoad);
