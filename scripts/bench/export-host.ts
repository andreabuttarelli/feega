import { mountCapturePlayer } from '$lib/motion/hyperframes/capture-player';
import { FrameFormat, Layering, Settle } from '$lib/motion/hyperframes/capture';
import { shootInLanes } from '$lib/motion/export/lanes';
import { encodeMp4 } from '$lib/motion/export/encode';
import { frameOf } from '$lib/motion/export/webgl-device';

import { STATS_REPLY, STATS_REQUEST, type BenchInput, type BenchResult, type ParityFrame, type ParityInput, type Stages } from './probe';

const statsOf = (frame: HTMLIFrameElement) =>
  new Promise<Stages>((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || e.data?.type !== STATS_REPLY) {
        return;
      }
      removeEventListener('message', onMessage);
      resolve(e.data.stages);
    };
    addEventListener('message', onMessage);
    frame.contentWindow?.postMessage({ type: STATS_REQUEST }, '*');
  });

const sum = (all: Stages[]): Stages => all.reduce((a, s) => ({ seek: a.seek + s.seek, serialize: a.serialize + s.serialize, paint: a.paint + s.paint, readback: a.readback + s.readback, shots: a.shots + s.shots, svgs: a.svgs + s.svgs }), { seek: 0, serialize: 0, paint: 0, readback: 0, shots: 0, svgs: 0 });

const base64 = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });

async function bench(input: BenchInput): Promise<BenchResult> {
  const host = document.getElementById('host') as HTMLElement;
  const players = await Promise.all(Array.from({ length: input.lanes }, () => mountCapturePlayer(host, input.html)));
  const request = { format: FrameFormat.Bitmap, settle: Settle.Seek, layering: input.layering as Layering, width: input.width, height: input.height };
  const signal = new AbortController().signal;
  let encodeMs = 0;
  const start = performance.now();
  const blob = await encodeMp4({
    size: { width: input.width, height: input.height },
    fps: input.fps,
    frames: input.times.length,
    samples: 1,
    audio: null,
    signal,
    onFrame: () => {},
    render: (onFrame) =>
      shootInLanes(
        input.times,
        players.map((p) => (time: number) => p.shoot(time, request, 600_000).then(frameOf)),
        async (bitmap, index) => {
          const t = performance.now();
          await onFrame(bitmap, index);
          encodeMs += performance.now() - t;
        },
        signal
      )
  });
  const wallMs = performance.now() - start;
  const frames = [...host.querySelectorAll('hyperframes-player')].map((p) => (p as HTMLElement & { iframeElement: HTMLIFrameElement }).iframeElement);
  const stages = sum(await Promise.all(frames.map(statsOf)));
  players.forEach((p) => p.dispose());
  return { wallMs, frames: input.times.length, stages, encodeMs, mp4: input.keep ? await base64(blob) : null };
}

const pixels = (bitmap: ImageBitmap) => {
  const pen = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d') as OffscreenCanvasRenderingContext2D;
  pen.drawImage(bitmap, 0, 0);
  return pen.getImageData(0, 0, bitmap.width, bitmap.height).data;
};

const VISIBLE_STEP = 8;

let live: Awaited<ReturnType<typeof mountCapturePlayer>> | null = null;

async function parity(input: ParityInput): Promise<ParityFrame[]> {
  const host = document.getElementById('host') as HTMLElement;
  const player = input.live ? (live ??= await mountCapturePlayer(host, input.html)) : await mountCapturePlayer(host, input.html);
  const frame = () => (host.querySelector('hyperframes-player') as HTMLElement & { iframeElement: HTMLIFrameElement }).iframeElement;
  let png: Promise<string> = Promise.resolve('');
  let flatPng: Promise<string> = Promise.resolve('');
  const shot = (time: number, layering: Layering) =>
    player.shoot(time, { format: FrameFormat.Bitmap, settle: Settle.Paint, layering, width: input.width, height: input.height }, 600_000).then((r) => {
      const bitmap = frameOf(r);
      const keep = new OffscreenCanvas(bitmap.width, bitmap.height);
      (keep.getContext('2d') as OffscreenCanvasRenderingContext2D).drawImage(bitmap, 0, 0, keep.width, keep.height);
      png = keep.convertToBlob().then(base64);
      return pixels(bitmap);
    });
  const out: ParityFrame[] = [];
  for (const time of input.times) {
    const before = (await statsOf(frame())).svgs;
    const flat = await shot(time, Layering.Flat);
    flatPng = png;
    const split = await shot(time, input.layering as Layering);
    let sum = 0;
    let over = 0;
    for (let i = 0; i < flat.length; i += 4) {
      const d = Math.max(Math.abs(flat[i] - split[i]), Math.abs(flat[i + 1] - split[i + 1]), Math.abs(flat[i + 2] - split[i + 2]));
      sum += d;
      over += d > VISIBLE_STEP ? 1 : 0;
    }
    const svgs = (await statsOf(frame())).svgs - before - 1;
    out.push({ time, mean: sum / (flat.length / 4), over: over / (flat.length / 4), svgs, png: await png, flat: await flatPng });
  }
  if (!input.live) {
    player.dispose();
  }
  return out;
}

Object.assign(window, { bench, parity });
