import { mountCapturePlayer } from '$lib/motion/hyperframes/capture-player';
import { FrameFormat, Layering, Settle } from '$lib/motion/hyperframes/capture';
import { shootInLanes } from '$lib/motion/export/lanes';
import { encodeMp4 } from '$lib/motion/export/encode';
import { exportLayering, frameOf } from '$lib/motion/export/webgl-device';
import { Freshness, GpuIneligible, gpuEngine } from '$lib/motion/gpu/engine';
import type { Backend } from '$lib/canvas/gpu/backend';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import type { MotionDoc } from '$lib/motion/doc';
import { drawFrame, prepare } from '$lib/motion/gpu-full/display-list';
import { createRaster } from '$lib/motion/gpu-full/raster';
import { createMedia } from '$lib/motion/gpu-full/media';
import { PREVIEW_PROBE, PROBE_REPLY, PROBE_REQUEST, type ExportInput, type ExportResult, type PreviewInput, type PreviewResult, type ShotsInput, type ShotsResult, type Spec } from './probe';

const composer = (spec: Spec) => (only?: ReadonlySet<string>) => composeHtml({ doc: spec.doc as MotionDoc, tokens: FEEGA_TOKENS, assets: spec.assets, origin: spec.origin, only });

const CAPTURE_WAIT_MS = 600_000;
const QUALITY = 'high' as never;

const host = () => document.getElementById('host') as HTMLElement;

const base64 = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });

async function png(source: CanvasImageSource, width: number, height: number): Promise<string> {
  const keep = new OffscreenCanvas(width, height);
  (keep.getContext('2d') as OffscreenCanvasRenderingContext2D).drawImage(source, 0, 0, width, height);
  return base64(await keep.convertToBlob());
}

async function htmlShots(input: ShotsInput): Promise<ShotsResult> {
  const player = await mountCapturePlayer(host(), input.html);
  const request = { format: FrameFormat.Bitmap, settle: Settle.Paint, layering: Layering.Flat, width: input.width, height: input.height };
  const pngs: string[] = [];
  const start = performance.now();
  for (const t of input.times) {
    const bitmap = frameOf(await player.shoot(t, request, CAPTURE_WAIT_MS));
    pngs.push(await png(bitmap, input.width, input.height));
  }
  player.dispose();
  return { pngs, ms: performance.now() - start, backend: 'html', runs: 0, stats: [] };
}

async function gpuShots(input: ShotsInput): Promise<ShotsResult> {
  const engine = await gpuEngine(composer(input.spec), host(), input.preference as Backend, input.displayWidth ?? null);
  const pngs: string[] = [];
  const stats = [];
  const start = performance.now();
  for (const t of input.times) {
    stats.push(await engine.renderAt(t, Freshness.Exact));
    pngs.push(await png(engine.canvas, input.width, input.height));
  }
  const out = { pngs, ms: performance.now() - start, backend: engine.backend, runs: engine.runs.length, stats };
  engine.dispose();
  return out;
}

async function gpuFullShots(input: ShotsInput): Promise<ShotsResult> {
  const doc = input.spec.doc as MotionDoc;
  const prepared = prepare(doc, FEEGA_TOKENS, input.spec.assets);
  const media = createMedia();
  const canvas = document.createElement('canvas');
  const raster = createRaster(canvas, input.width, input.height);
  const pngs: string[] = [];
  const gaps = new Map<string, string>();
  const start = performance.now();
  for (const t of input.times) {
    const list = drawFrame(prepared, Math.round(t * doc.fps));
    list.unsupported.forEach((g) => gaps.set(g.clip, `${g.component}:${g.reason}`));
    await media.ready(list);
    raster.draw(list, media.pictures);
    pngs.push(await png(canvas, input.width, input.height));
  }
  const out = { pngs, ms: performance.now() - start, backend: 'gpu-full webgl2', runs: 0, stats: [], unsupported: [...gaps].map(([clip, why]) => `${clip} ${why}`) };
  raster.dispose();
  media.dispose();
  return out;
}

async function encode(input: ExportInput, render: (onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>) => Promise<void>): Promise<ExportResult> {
  const start = performance.now();
  const blob = await encodeMp4({ size: { width: input.width, height: input.height }, fps: input.fps, quality: QUALITY, frames: input.times.length, samples: 1, audio: null, signal: new AbortController().signal, onFrame: () => {}, render });
  return { wallMs: performance.now() - start, frames: input.times.length, mp4: input.keep ? await base64(blob) : null };
}

async function htmlExport(input: ExportInput): Promise<ExportResult> {
  const players = await Promise.all(Array.from({ length: input.lanes }, () => mountCapturePlayer(host(), input.html)));
  const request = { format: FrameFormat.Bitmap, settle: Settle.Seek, layering: exportLayering(), width: input.width, height: input.height };
  const signal = new AbortController().signal;
  const out = await encode(input, (onFrame) => shootInLanes(input.times, players.map((p) => (t: number) => p.shoot(t, request, CAPTURE_WAIT_MS).then(frameOf)), onFrame, signal));
  players.forEach((p) => p.dispose());
  return out;
}

async function gpuExport(input: ExportInput): Promise<ExportResult> {
  const engine = await gpuEngine(composer(input.spec), host(), input.preference as Backend).catch((e) => (e instanceof GpuIneligible ? null : Promise.reject(e)));
  if (!engine) {
    return { ...(await htmlExport(input)), fallback: true };
  }
  const out = await encode(input, (onFrame) => engine.renderFrames(input.times, onFrame, input.lanes, new AbortController().signal));
  engine.dispose();
  return out;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;
}

function summary(deltas: number[], work: number[]): PreviewResult {
  const BUDGET_MS = 1000 / 60 + 2;
  return { frames: deltas.length, p50: percentile(deltas, 0.5), p95: percentile(deltas, 0.95), dropped: deltas.filter((d) => d > BUDGET_MS).length, workP50: percentile(work, 0.5), workP95: percentile(work, 0.95) };
}

async function htmlPreview(input: PreviewInput): Promise<PreviewResult> {
  await import('@hyperframes/player');
  const el = document.createElement('hyperframes-player') as HTMLElement & { play: () => void; pause: () => void; iframeElement: HTMLIFrameElement };
  el.setAttribute('sandbox-origin', 'opaque');
  el.setAttribute('disable-click-to-play', '');
  el.loop = true;
  el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const ready = new Promise((r) => el.addEventListener('ready', r, { once: true }));
  host().appendChild(el);
  el.setAttribute('srcdoc', input.html.replace(/<head[^>]*>/, (head) => `${head}<script>${PREVIEW_PROBE}</script>`));
  await ready;
  await new Promise((r) => setTimeout(r, input.warmMs));
  const ask = () =>
    new Promise<{ deltas: number[] }>((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === PROBE_REPLY) {
          removeEventListener('message', onMessage);
          resolve(e.data);
        }
      };
      addEventListener('message', onMessage);
      el.iframeElement.contentWindow?.postMessage({ type: PROBE_REQUEST }, '*');
    });
  await ask();
  el.play();
  await new Promise((r) => setTimeout(r, input.seconds * 1000));
  const reply = await ask();
  el.pause();
  el.remove();
  return summary(reply.deltas.slice(1), []);
}

async function gpuPreview(input: PreviewInput): Promise<PreviewResult> {
  const engine = await gpuEngine(composer(input.spec), host(), input.preference as Backend);
  engine.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  host().appendChild(engine.canvas);
  await engine.renderAt(0, Freshness.Exact);
  await new Promise((r) => setTimeout(r, input.warmMs));
  const deltas: number[] = [];
  const work: number[] = [];
  const start = performance.now();
  let last = start;
  while (performance.now() - start < input.seconds * 1000) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    deltas.push(now - last);
    last = now;
    const t = (((now - start) / 1000) % engine.scene.duration) || 0;
    const w0 = performance.now();
    await engine.renderAt(t, Freshness.Latest);
    work.push(performance.now() - w0);
  }
  engine.dispose();
  return summary(deltas.slice(1), work);
}

let live: (HTMLElement & { seek: (t: number) => void; pause: () => void }) | null = null;

async function liveMount(input: { html: string; width: number; height: number }) {
  await import('@hyperframes/player');
  const el = document.createElement('hyperframes-player') as HTMLElement & { seek: (t: number) => void; pause: () => void };
  el.setAttribute('sandbox-origin', 'opaque');
  el.setAttribute('disable-click-to-play', '');
  el.style.cssText = `position:absolute;left:0;top:0;width:${input.width}px;height:${input.height}px`;
  const ready = new Promise((r) => el.addEventListener('ready', r, { once: true }));
  host().replaceChildren(el);
  el.setAttribute('srcdoc', input.html);
  await ready;
  live = el;
}

async function liveSeek(t: number) {
  live?.seek(t);
  await new Promise((r) => setTimeout(r, 400));
}

Object.assign(window, { liveMount, liveSeek, htmlShots, gpuShots, gpuFullShots, htmlExport, gpuExport, htmlPreview, gpuPreview });
