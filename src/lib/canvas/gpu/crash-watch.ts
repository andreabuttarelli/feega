import { CrashRecorder, blankSample, wasInGesture, type CrashSample } from './crash-record';
import { pollLag, probeGpu, wasmBytes, type GpuCounters } from './gpu-probe';

export enum Motion {
  Still = 'still',
  Moving = 'moving'
}

export type Tick = { x: number; y: number; zoom: number; now: number; motion: Motion; rastered: boolean };

export type Sizes = { device: string; dpr: number; resolution: number };

const CRASH_URL = '/api/v1/telemetry/crash';
const MS_PER_SECOND = 1000;

type Last = { x: number; y: number; zoom: number; now: number };
const last = new WeakMap<CrashSample, Last>();

export function track(sample: CrashSample, t: Tick): void {
  const before = last.get(sample);
  const dt = before ? (t.now - before.now) / MS_PER_SECOND : 0;
  if (before && dt > 0) {
    sample.zoomPerSecond = Math.abs(Math.log2(t.zoom / before.zoom)) / dt;
    sample.panPerSecond = Math.hypot(t.x - before.x, t.y - before.y) / dt;
  }
  if (before) {
    Object.assign(before, { x: t.x, y: t.y, zoom: t.zoom, now: t.now });
  } else {
    last.set(sample, { x: t.x, y: t.y, zoom: t.zoom, now: t.now });
  }
  sample.zoom = t.zoom;
  sample.at = t.now;
  sample.gestureFrames = t.motion === Motion.Moving ? sample.gestureFrames + 1 : 0;
  if (t.rastered) {
    sample.rasterZoom = t.zoom;
  }
}

export type Gauges = { cacheBytes: number; pictureBytes: number; scratchBytes: number; wasmBytes: number; width: number; height: number };

export function gauged(sample: CrashSample, gpu: GpuCounters, raster: Gauges): void {
  sample.textureBytes = gpu.textureBytes;
  sample.textures = gpu.textures;
  sample.texturesCreated = gpu.created;
  sample.submits = gpu.submits;
  sample.gpuLagMs = gpu.lagMs;
  sample.wasmBytes = Math.max(wasmBytes(gpu), raster.wasmBytes);
  sample.cacheBytes = raster.cacheBytes;
  sample.pictureBytes = raster.pictureBytes;
  sample.scratchBytes = raster.scratchBytes;
  sample.canvas = `${raster.width}x${raster.height}`;
}

function send(report: CrashSample): void {
  void fetch(CRASH_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report), keepalive: true }).catch(() => undefined);
}

function shelf(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export type CrashWatch = { tick: (t: Tick, raster: Gauges) => void; sample: CrashSample; stop: () => void };

export function watchCrashes(sizes: Sizes): CrashWatch {
  const gpu = probeGpu(window as never);
  const store = shelf();
  const recorder = store ? new CrashRecorder(store) : null;
  const previous = recorder?.begin();
  if (previous && wasInGesture(previous)) {
    send(previous);
  }

  const sample = blankSample();
  Object.assign(sample, { device: sizes.device, dpr: sizes.dpr, resolution: sizes.resolution });

  const hidden = () => recorder?.endCleanly();
  const visibility = () => (document.visibilityState === 'hidden' ? recorder?.endCleanly() : recorder?.resume());
  window.addEventListener('pagehide', hidden);
  document.addEventListener('visibilitychange', visibility);

  return {
    sample,
    tick(t, raster) {
      track(sample, t);
      gauged(sample, gpu, raster);
      pollLag(gpu, () => performance.now());
      recorder?.sample(sample, t.now);
    },
    stop() {
      window.removeEventListener('pagehide', hidden);
      document.removeEventListener('visibilitychange', visibility);
      recorder?.endCleanly();
    }
  };
}

const MB = 1024 * 1024;
const mb = (bytes: number) => (bytes / MB).toFixed(1);

export const hudLine = (s: CrashSample) =>
  `${s.device} dpr=${s.dpr} res=${s.resolution} canvas=${s.canvas} tex=${mb(s.textureBytes)}MB/${s.textures} made=${s.texturesCreated} submits=${s.submits} lag=${Math.round(s.gpuLagMs)}ms cache=${mb(s.cacheBytes)}MB scratch=${mb(s.scratchBytes)}MB pict=${mb(s.pictureBytes)}MB wasm=${mb(s.wasmBytes)}MB zoom/s=${s.zoomPerSecond.toFixed(2)} pan/s=${Math.round(s.panPerSecond)} gf=${s.gestureFrames} rasterZoom=${s.rasterZoom.toFixed(3)}`;
