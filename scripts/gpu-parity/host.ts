import { mountCapturePlayer } from '$lib/motion/hyperframes/capture-player';
import { FrameFormat, Layering, Settle } from '@feega/motion-core/motion/hyperframes/capture';
import { shootInLanes } from '$lib/motion/export/lanes';
import { encodeMp4 } from '$lib/motion/export/encode';
import { exportLayering, frameOf } from '$lib/motion/export/webgl-device';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { createMedia } from '@feega/motion-core/motion/gpu-full/media';
import { faceEngineOf, loadFontsWith } from '@feega/motion-core/motion/gpu-full/text/engines';
import { mountCustomReads } from '@feega/motion-core/motion/gpu-full/dom/custom';
import { smoothingOf } from '@feega/motion-core/motion/gpu-full/text/painter';
import { BACKENDS, FullBackend } from '@feega/motion-core/motion/gpu-full/backends';
import { renderOnCore } from '$lib/motion/gpu-full/core-export';
import { type ExportInput, type ExportResult, type PreviewInput, type PreviewResult, type ShotsInput, type ShotsResult, type Spec } from './probe';

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

async function fullShots(input: ShotsInput, backend: FullBackend): Promise<ShotsResult> {
  const doc = input.spec.doc as MotionDoc;
  const prepared = prepare(doc, FEEGA_TOKENS, input.spec.assets, { fonts: await loadFontsWith(faceEngineOf(input.spec.faces))(doc, input.spec.assets, FEEGA_TOKENS), smoothing: smoothingOf(navigator.userAgent) });
  const media = createMedia();
  const custom = await mountCustomReads(host(), composer(input.spec), prepared);
  const canvas = document.createElement('canvas');
  const raster = await BACKENDS[backend](canvas, input.width, input.height);
  const pngs: string[] = [];
  const gaps = new Map<string, string>();
  const start = performance.now();
  for (const t of input.times) {
    const frame = Math.round(t * doc.fps);
    const read = await custom.readAt(frame);
    const list = drawFrame(prepared, frame, read.reads);
    list.unsupported.forEach((g) => gaps.set(`${g.clip} ${g.component}:${g.reason}${g.detail ? ` ${g.detail}` : ''}`, ''));
    await media.ready(list);
    raster.draw(list, (item) => read.picture(item) ?? media.pictures(item));
    pngs.push(await png(canvas, input.width, input.height));
  }
  const out = { pngs, ms: performance.now() - start, backend: `gpu-full ${backend}`, runs: 0, stats: [], unsupported: [...gaps.keys()] };
  raster.dispose();
  media.dispose();
  custom.dispose();
  return out;
}

const gpuFullShots = (input: ShotsInput) => fullShots(input, FullBackend.WebGl2);
const gpuCoreShots = (input: ShotsInput) => fullShots(input, FullBackend.Core);
const gpuCoreGlShots = (input: ShotsInput) => fullShots(input, FullBackend.CoreGl);

async function coreExportShots(input: ShotsInput, backend: FullBackend): Promise<ShotsResult> {
  const doc = input.spec.doc as MotionDoc;
  const prepared = prepare(doc, FEEGA_TOKENS, input.spec.assets, { fonts: await loadFontsWith(faceEngineOf(input.spec.faces))(doc, input.spec.assets, FEEGA_TOKENS), smoothing: smoothingOf(navigator.userAgent) });
  const custom = await mountCustomReads(host(), composer(input.spec), prepared);
  const pngs: string[] = [];
  const start = performance.now();
  const done = await renderOnCore(prepared, backend, input.times, async (bitmap) => void pngs.push(await png(bitmap, input.width, input.height)), new AbortController().signal, custom);
  custom.dispose();
  if (!done) {
    throw new Error('core export fell back to HTML');
  }
  return { pngs, ms: performance.now() - start, backend: `core export ${backend}`, runs: 0, stats: [] };
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

async function coreExport(input: ExportInput): Promise<ExportResult> {
  const doc = input.spec.doc as MotionDoc;
  const prepared = prepare(doc, FEEGA_TOKENS, input.spec.assets, { fonts: await loadFontsWith(faceEngineOf(input.spec.faces))(doc, input.spec.assets, FEEGA_TOKENS), smoothing: smoothingOf(navigator.userAgent) });
  const custom = await mountCustomReads(host(), composer(input.spec), prepared);
  const signal = new AbortController().signal;
  let drawn = true;
  const out = await encode(input, async (onFrame) => {
    drawn = await renderOnCore(prepared, FullBackend.Core, input.times, onFrame, signal, custom);
  });
  custom.dispose();
  return drawn ? out : { ...(await htmlExport(input)), fallback: true };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;
}

function summary(deltas: number[], work: number[]): PreviewResult {
  const BUDGET_MS = 1000 / 60 + 2;
  return { frames: deltas.length, p50: percentile(deltas, 0.5), p95: percentile(deltas, 0.95), dropped: deltas.filter((d) => d > BUDGET_MS).length, worst: Math.max(...deltas), workP50: percentile(work, 0.5), workP95: percentile(work, 0.95) };
}

const SCRUB_PERIOD_S = 2;

const sweepFrame = (now: number, start: number, frames: number) => {
  const phase = (((now - start) / 1000 / SCRUB_PERIOD_S) % 1) * 2;
  return Math.round((phase < 1 ? phase : 2 - phase) * (frames - 1));
};

async function htmlScrub(input: PreviewInput): Promise<PreviewResult> {
  await import('@hyperframes/player');
  const doc = input.spec.doc as MotionDoc;
  const el = document.createElement('hyperframes-player') as HTMLElement & { seek: (t: number) => void };
  el.setAttribute('sandbox-origin', 'opaque');
  el.setAttribute('disable-click-to-play', '');
  el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const ready = new Promise((r) => el.addEventListener('ready', r, { once: true }));
  host().appendChild(el);
  el.setAttribute('srcdoc', input.html);
  await ready;
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
    const w0 = performance.now();
    el.seek(sweepFrame(now, start, doc.durationInFrames) / doc.fps);
    work.push(performance.now() - w0);
  }
  el.remove();
  return summary(deltas.slice(1), work);
}

async function coreScrub(input: PreviewInput): Promise<PreviewResult> {
  const doc = input.spec.doc as MotionDoc;
  const prepared = prepare(doc, FEEGA_TOKENS, input.spec.assets, { fonts: await loadFontsWith(faceEngineOf(input.spec.faces))(doc, input.spec.assets, FEEGA_TOKENS), smoothing: smoothingOf(navigator.userAgent) });
  const media = createMedia();
  const custom = await mountCustomReads(host(), composer(input.spec), prepared);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  host().appendChild(canvas);
  const raster = await BACKENDS[FullBackend.Core](canvas, doc.width, doc.height);
  const phases: Record<string, number[]> = { read: [], build: [], ready: [], raster: [] };
  const lap = (name: string, since: number) => {
    phases[name].push(performance.now() - since);
    return performance.now();
  };
  const draw = async (frame: number) => {
    let t = performance.now();
    const read = await custom.readAt(frame);
    t = lap('read', t);
    const list = drawFrame(prepared, frame, read.reads);
    t = lap('build', t);
    await media.ready(list);
    t = lap('ready', t);
    raster.draw(list, (item) => read.picture(item) ?? media.pictures(item));
    lap('raster', t);
  };
  await draw(0);
  await new Promise((r) => setTimeout(r, input.warmMs));
  const deltas: number[] = [];
  const work: number[] = [];
  const start = performance.now();
  let last = start;
  let drawn = -1;
  let busy = false;
  while (performance.now() - start < input.seconds * 1000) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    deltas.push(now - last);
    last = now;
    const frame = sweepFrame(now, start, doc.durationInFrames);
    if (busy || frame === drawn) {
      continue;
    }
    drawn = frame;
    busy = true;
    const w0 = performance.now();
    void draw(frame).finally(() => {
      work.push(performance.now() - w0);
      busy = false;
    });
  }
  await new Promise((r) => setTimeout(r, 200));
  raster.dispose();
  media.dispose();
  custom.dispose();
  console.log('phases p50/p95/max', JSON.stringify(Object.fromEntries(Object.entries(phases).map(([k, v]) => [k, [percentile(v, 0.5), percentile(v, 0.95), percentile(v, 1)].map((n) => +n.toFixed(2))]))));
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

Object.assign(window, { liveMount, liveSeek, htmlShots, gpuFullShots, gpuCoreShots, gpuCoreGlShots, coreExportShots: (i: ShotsInput) => coreExportShots(i, FullBackend.Core), coreExportGlShots: (i: ShotsInput) => coreExportShots(i, FullBackend.CoreGl), htmlExport, coreExport, htmlScrub, coreScrub });
