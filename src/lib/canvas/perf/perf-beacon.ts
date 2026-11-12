import { CORE_VERSION } from '@feega/motion-core/motion/gpu-full/core-version';
import { Camera, LoadStep, gestureOf, sessionPerf, type Context, type SessionPerf } from './session-perf';

export const PERF_SAMPLE_RATE = 1;
const PERF_URL = '/api/v1/telemetry/canvas-perf';
const FLUSH_MS = 5 * 60_000;
const HEAP_AT_MS = 10 * 60_000;
const MB = 1024 * 1024;
const SOURCES = /\/motion\/sources/;

const LOAD_MARKS: Record<LoadStep, string> = {
  [LoadStep.FirstContent]: 'startup|first-drawn',
  [LoadStep.AllFrames]: 'startup|all-shown',
  [LoadStep.Sharp]: 'frame|sharp|all'
};

export type PerfPlace = { canvasId: string; device: string; dpr: number; frames: () => number };

export type CanvasPerf = {
  frame: (camera: Camera, lifting: boolean, at: number) => void;
  edit: (ms: number) => void;
  backend: (name: string) => void;
  deviceLost: () => void;
  stop: () => void;
};

const NO_PERF: CanvasPerf = { frame: () => {}, edit: () => {}, backend: () => {}, deviceLost: () => {}, stop: () => {} };

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

  const context = (): Context => ({ sessionId, canvasId: place.canvasId, device: place.device, dpr: place.dpr, cores: nav.hardwareConcurrency ?? 0, memoryGb: nav.deviceMemory ?? null, coreVersion: CORE_VERSION, frames: place.frames(), nodes, docBytes: docBytes(), heapMb: heap });

  const flush = () => {
    for (const step of Object.values(LoadStep)) {
      const at = markAt(LOAD_MARKS[step]);
      if (at !== null) {
        perf.load(step, at);
      }
    }
    const body = JSON.stringify(perf.summary(context(), performance.now()));
    try {
      if (!navigator.sendBeacon?.(PERF_URL, new Blob([body], { type: 'application/json' }))) {
        void fetch(PERF_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
      }
    } catch {
      return;
    }
  };
  const hidden = () => document.visibilityState === 'hidden' && flush();

  const unwatch = watchLongTasks(perf);
  const every = setInterval(flush, FLUSH_MS);
  const heapTimer = setTimeout(() => (heap = heapMb()), HEAP_AT_MS);
  window.addEventListener('pagehide', flush);
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
    backend: perf.backend,
    deviceLost: perf.deviceLost,
    stop() {
      flush();
      unwatch();
      clearInterval(every);
      clearTimeout(heapTimer);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    }
  };
}
