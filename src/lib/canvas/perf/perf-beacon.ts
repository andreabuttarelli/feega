import { CORE_VERSION } from '@feega/motion-core/motion/gpu-full/core-version';
import { Camera, LoadStep, gestureOf, sessionPerf, type Context, type SessionPerf } from './session-perf';

export const PERF_SAMPLE_RATE = 1;
const PERF_URL = '/api/v1/telemetry/canvas-perf';
const FLUSH_MS = 5 * 60_000;
const HEAP_AT_MS = 10 * 60_000;
const MB = 1024 * 1024;
const SOURCES = /\/motion\/sources/;
const MAX_ERROR = 200;

const LOAD_MARKS: Record<LoadStep, string> = {
  [LoadStep.FirstContent]: 'startup|first-drawn',
  [LoadStep.AllFrames]: 'startup|all-shown',
  [LoadStep.Sharp]: 'frame|sharp|all'
};

export type Memory = { textureMb: number; textures: number; bufferMb: number; wasmMb: number; cacheMb: number; pictureMb: number };

export type Before = Memory & { zoom: number; gestureFrames: number };

export type PerfPlace = { canvasId: string; device: string; platform: string; dpr: number; frames: () => number; area: () => { width: number; height: number }; memory: () => Memory | null; diedBefore: boolean; before: Before | null };

export enum Beacon {
  Start = 'start',
  Heartbeat = 'heartbeat',
  Hidden = 'hidden',
  PageHide = 'pagehide',
  Stop = 'stop'
}

type Limits = { maxTexture: number; maxBuffer: number };

const LIMITS_WAIT_MS = 2000;
const WEBGPU = 'webgpu';

type GpuNavigator = { gpu?: { requestAdapter: () => Promise<{ limits: { maxTextureDimension2D: number; maxBufferSize: number } } | null> } };

async function adapterLimits(): Promise<Limits | null> {
  const asking = (navigator as GpuNavigator).gpu?.requestAdapter().then((a) => (a ? { maxTexture: a.limits.maxTextureDimension2D, maxBuffer: a.limits.maxBufferSize } : null));
  if (!asking) {
    return null;
  }
  const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), LIMITS_WAIT_MS));
  return Promise.race([asking.catch(() => null), late]);
}

export type CanvasPerf = {
  frame: (camera: Camera, lifting: boolean, at: number) => void;
  edit: (ms: number) => void;
  backend: (name: string) => void;
  deviceLost: () => void;
  error: (why: string) => void;
  stop: () => void;
};

const NO_PERF: CanvasPerf = { frame: () => {}, edit: () => {}, backend: () => {}, deviceLost: () => {}, error: () => {}, stop: () => {} };

let fitting = false;
let fitMoved = false;
let nodes = 0;

export const perfFit = () => {
  fitting = true;
};

export const perfNodes = (count: number) => {
  nodes = count;
};

function markAt(name: string): number | null {
  return performance.getEntriesByName(name, 'mark')[0]?.startTime ?? null;
}

function docBytes(): number {
  return (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter((r) => SOURCES.test(r.name)).reduce((sum, r) => sum + (r.encodedBodySize || r.transferSize || 0), 0);
}

function heapMb(): number | null {
  const used = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  return typeof used === 'number' ? Math.round(used / MB) : null;
}

function watchLongTasks(perf: SessionPerf): () => void {
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach((e) => perf.longTask(e.duration)));
    observer.observe({ type: 'longtask', buffered: true });
    return () => observer.disconnect();
  } catch {
    return () => {};
  }
}

export function startCanvasPerf(place: PerfPlace, random: () => number = Math.random): CanvasPerf {
  if (typeof window === 'undefined' || random() >= PERF_SAMPLE_RATE) {
    return NO_PERF;
  }

  const startedAt = performance.now();
  const perf = sessionPerf(startedAt);
  const sessionId = crypto.randomUUID();
  const nav = navigator as Navigator & { deviceMemory?: number };
  let heap: number | null = null;
  let lastError: string | null = null;
  let limits: Limits | null = null;
  let started = false;

  const context = (): Context => ({ sessionId, canvasId: place.canvasId, device: place.device, dpr: place.dpr, cores: nav.hardwareConcurrency ?? 0, memoryGb: nav.deviceMemory ?? null, coreVersion: CORE_VERSION, frames: place.frames(), nodes, docBytes: docBytes(), heapMb: heap });

  const health = (reason: Beacon) => ({ reason, platform: place.platform, visible: Number(document.visibilityState === 'visible'), ...place.area(), diedBefore: Number(place.diedBefore), lastError, limits, memory: place.memory(), before: place.before });

  const flush = (reason: Beacon) => {
    for (const step of Object.values(LoadStep)) {
      const at = markAt(LOAD_MARKS[step]);
      if (at !== null) {
        perf.load(step, at);
      }
    }
    const body = JSON.stringify({ ...perf.summary(context(), performance.now()), ...health(reason) });
    try {
      if (!navigator.sendBeacon?.(PERF_URL, new Blob([body], { type: 'application/json' }))) {
        void fetch(PERF_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
      }
    } catch {
      return;
    }
  };
  const hidden = () => document.visibilityState === 'hidden' && flush(Beacon.Hidden);
  const gone = () => flush(Beacon.PageHide);
  const remember = (why: unknown) => (lastError = String(why).slice(0, MAX_ERROR));
  const thrown = (e: Event) => remember((e as ErrorEvent).message);
  const rejected = (e: Event) => remember((e as PromiseRejectionEvent).reason);

  const unwatch = watchLongTasks(perf);
  const every = setInterval(() => flush(Beacon.Heartbeat), FLUSH_MS);
  const heapTimer = setTimeout(() => (heap = heapMb()), HEAP_AT_MS);
  window.addEventListener('pagehide', gone);
  window.addEventListener('error', thrown);
  window.addEventListener('unhandledrejection', rejected);
  document.addEventListener('visibilitychange', hidden);

  return {
    frame(camera, lifting, at) {
      perf.frame(gestureOf({ lifting, camera, fitting }), at);
      fitMoved ||= fitting && camera !== Camera.Still;
      if (fitMoved && camera === Camera.Still) {
        fitting = false;
        fitMoved = false;
      }
    },
    edit: perf.edit,
    backend(name) {
      perf.backend(name);
      if (started) {
        return;
      }
      started = true;
      void (name === WEBGPU ? adapterLimits() : Promise.resolve(null)).then((found) => {
        limits = found;
        flush(Beacon.Start);
      });
    },
    deviceLost: perf.deviceLost,
    error: remember,
    stop() {
      flush(Beacon.Stop);
      unwatch();
      clearInterval(every);
      clearTimeout(heapTimer);
      window.removeEventListener('pagehide', gone);
      window.removeEventListener('error', thrown);
      window.removeEventListener('unhandledrejection', rejected);
      document.removeEventListener('visibilitychange', hidden);
    }
  };
}
