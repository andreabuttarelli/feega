import { createRamPreview } from '../../packages/motion-core/src/motion/gpu-full/ram-preview';
import { createWebCodecsFrames } from '../../src/lib/motion/gpu/webcodecs-decoder';

const FPS = 30;
const SEEKS = 30;
const PLAY_SECONDS = 5;
const RENDER_WIDTH = 1920;
const CLIP_SECONDS = 10;
const SEEK_SEED = 7;
const BUDGET = 2 * 1024 * 1024 * 1024;

type Stats = { p50: number; p95: number; max: number };

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

function stats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), max: sorted[sorted.length - 1] };
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const randomTimes = () => {
  const next = seeded(SEEK_SEED);
  return Array.from({ length: SEEKS }, () => Math.floor(next() * (CLIP_SECONDS - 1) * FPS) / FPS);
};

function videoElement(url: string): Promise<HTMLVideoElement> {
  const el = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', src: url });
  return new Promise((ok, ko) => {
    el.addEventListener('loadeddata', () => ok(el), { once: true });
    el.addEventListener('error', () => ko(new Error('video')), { once: true });
  });
}

function seekElement(el: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((ok) => {
    el.addEventListener('seeked', () => ok(), { once: true });
    el.currentTime = t;
  });
}

async function timed(job: () => Promise<unknown>) {
  const t0 = performance.now();
  await job();
  return performance.now() - t0;
}

const nextTick = () => new Promise<number>((ok) => requestAnimationFrame(ok));

async function playLoop(load: (frame: number) => Promise<unknown>) {
  const presented = new Set<number>();
  const start = await nextTick();
  let busy = false;
  for (;;) {
    const now = await nextTick();
    const elapsed = (now - start) / 1000;
    if (elapsed >= PLAY_SECONDS) {
      break;
    }
    if (busy) {
      continue;
    }
    busy = true;
    const frame = Math.round(elapsed * FPS);
    void load(frame).then(() => {
      presented.add(frame);
      busy = false;
    });
  }
  const expected = PLAY_SECONDS * FPS;
  return { expected, presented: presented.size, dropped: expected - presented.size };
}

async function baseline(url: string) {
  const el = await videoElement(url);
  const seek = [];
  for (const t of randomTimes()) {
    seek.push(await timed(async () => {
      await seekElement(el, t);
      await createImageBitmap(el, { resizeWidth: RENDER_WIDTH });
    }));
  }
  el.currentTime = 0;
  await seekElement(el, 0);
  const play = await playLoop(async (frame) => {
    await seekElement(el, frame / FPS);
    await createImageBitmap(el, { resizeWidth: RENDER_WIDTH });
  });
  return { seek: stats(seek), play };
}

async function webcodecs(url: string) {
  const frames = createWebCodecsFrames(BUDGET);
  const times = randomTimes();
  const cold = [];
  for (const t of times) {
    cold.push(await timed(() => frames.at(url, t, RENDER_WIDTH)));
  }
  const warm = [];
  for (const t of times) {
    warm.push(await timed(() => frames.at(url, t, RENDER_WIDTH)));
  }
  frames.dispose();

  const playFrames = createWebCodecsFrames(BUDGET);
  const play = await playLoop((frame) => playFrames.at(url, frame / FPS, RENDER_WIDTH));

  const cachedFrames = createWebCodecsFrames(BUDGET);
  const ram = createRamPreview({ frames: cachedFrames, uses: (frame) => [{ src: url, time: frame / FPS, width: RENDER_WIDTH }] });
  const fillMs = await timed(() => ram.fill({ from: 0, to: PLAY_SECONDS * FPS }, new AbortController().signal));
  const ramPlay = await playLoop((frame) => cachedFrames.at(url, frame / FPS, RENDER_WIDTH));
  return { seekCold: stats(cold), seekWarm: stats(warm), play, ram: { fillMs, fillFps: (PLAY_SECONDS * FPS) / (fillMs / 1000), play: ramPlay } };
}

(window as unknown as { bench: (url: string) => Promise<unknown> }).bench = async (url) => ({ baseline: await baseline(url), webcodecs: await webcodecs(url) });
