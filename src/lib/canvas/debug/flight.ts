import { version } from '$app/environment';
import { CORE_VERSION } from '@feega/motion-core/motion/gpu-full/core-version';
import { probeGpu } from '$lib/canvas/gpu/gpu-probe';
import { Send, changed, closeMark, createFlightLog, finite, flightWanted, openMark, type FlightLine, type FlightLog, type Previous, type Props, type Shelf } from './flight-log';

const DEBUG_URL = '/api/v1/telemetry/canvas-debug';
const BATCH_VERSION = 1;
const SAMPLE_MS = 250;
const FLUSH_MS = 300;
const HEARTBEAT_MS = 2000;
const HEAP_EVERY_MS = 5000;
const WHEEL_QUIET_MS = 150;
const NOTABLE_LAG_MS = 50;
const EVENTS_PER_KIND = 300;
const BIG_TEXTURE_BYTES = 4 * 1024 * 1024;
const BIG_RESOURCE_BYTES = 256 * 1024;
const SESSION_CHARS = 10;
const SOURCES = /\/motion\/sources\?/;
const FRAME_STEPS = new Set(['asked', 'built', 'drawn', 'sharp', 'images']);
const UNCOUNTED = new Set(['sample', 'gesture']);
const WRAPPED = Symbol.for('feega.flight');

export type FlightEnv = { search: string; tab: Shelf | null };
export type FlightPlace = { canvasId: string; device: string; read: () => Props };
export type Flight = { session: string; previous: Previous | null; stop: () => void };

type Recorder = { log: FlightLog; counts: Map<string, number> };

let active: Recorder | null = null;

export function flightNote(kind: string, props?: Props): void {
  if (!active) {
    return;
  }
  if (!UNCOUNTED.has(kind)) {
    const seen = (active.counts.get(kind) ?? 0) + 1;
    active.counts.set(kind, seen);
    if (seen > EVENTS_PER_KIND) {
      return;
    }
  }
  active.log.note(kind, props);
}

const flushNow = () => active?.log.flush(Send.Fetch);

function browserEnv(): FlightEnv {
  if (typeof window === 'undefined') {
    return { search: '', tab: null };
  }
  let tab: Shelf | null = null;
  try {
    tab = window.sessionStorage;
  } catch {
    tab = null;
  }
  return { search: location.search, tab };
}

function poster(session: string, canvas: string) {
  return (lines: FlightLine[], how: Send) => {
    const body = JSON.stringify({ v: BATCH_VERSION, session, canvas, lines });
    try {
      if (how === Send.Beacon && navigator.sendBeacon?.(DEBUG_URL, new Blob([body], { type: 'application/json' }))) {
        return;
      }
      void fetch(DEBUG_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
    } catch {
      return;
    }
  };
}

const numbers = (props: Props): Props => {
  const out: Props = {};
  for (const key in props) {
    const value = props[key];
    out[key] = typeof value === 'number' ? finite(value) : value;
  }
  return out;
};

function deviceFacts(): Props {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const viewport = window.visualViewport;
  return {
    ua: nav.userAgent,
    platform: nav.platform,
    touchPoints: nav.maxTouchPoints,
    screen: `${screen.width}x${screen.height}`,
    dpr: devicePixelRatio,
    memoryGb: nav.deviceMemory ?? null,
    cores: nav.hardwareConcurrency ?? null,
    viewport: viewport ? `${Math.round(viewport.width)}x${Math.round(viewport.height)}@${finite(viewport.scale)}` : `${innerWidth}x${innerHeight}`,
    gpu: 'gpu' in nav,
    app: version,
    core: CORE_VERSION
  };
}

type Wrappable = Record<string | symbol, unknown>;

function wrapOnce(proto: Wrappable | undefined, name: string, wrap: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown): void {
  const original = proto?.[name];
  if (!proto || typeof original !== 'function' || (original as unknown as Wrappable)[WRAPPED]) {
    return;
  }
  const wrapped = wrap(original as (...args: unknown[]) => unknown) as unknown as Wrappable;
  wrapped[WRAPPED] = true;
  proto[name] = wrapped;
}

type Limits = Record<string, number>;
type Adapter = { info?: Record<string, string>; limits?: Limits; requestDevice: (...args: unknown[]) => Promise<GpuDevice> };
type GpuDevice = { lost?: Promise<{ reason?: string; message?: string }>; addEventListener?: (type: string, listener: (e: { error?: { message?: string } }) => void) => void };

function watchDevice(device: GpuDevice): void {
  void device.lost?.then((info) => {
    flightNote('device-lost', { reason: info?.reason ?? null, message: info?.message ?? null });
    flushNow();
  });
  device.addEventListener?.('uncapturederror', (e) => flightNote('gpu-error', { message: e.error?.message ?? null }));
}

function watchAdapters(): void {
  const proto = (globalThis as { GPU?: { prototype: Wrappable } }).GPU?.prototype;
  wrapOnce(proto, 'requestAdapter', (original) =>
    async function (this: unknown, ...args: unknown[]) {
      const adapter = (await original.apply(this, args)) as Adapter | null;
      if (!adapter) {
        flightNote('adapter', { none: true });
        return adapter;
      }
      const { maxTextureDimension2D, maxBufferSize, maxStorageBufferBindingSize } = adapter.limits ?? {};
      const info = adapter.info ?? {};
      flightNote('adapter', { vendor: info.vendor ?? null, architecture: info.architecture ?? null, device: info.device ?? null, description: info.description ?? null, maxTextureDimension2D, maxBufferSize, maxStorageBufferBindingSize });
      const ask = adapter.requestDevice.bind(adapter);
      adapter.requestDevice = async (...more: unknown[]) => {
        const device = await ask(...more);
        watchDevice(device);
        return device;
      };
      return adapter;
    }
  );
}

const GL_FACTS: [string, string][] = [
  ['maxTexture', 'MAX_TEXTURE_SIZE'],
  ['maxRenderbuffer', 'MAX_RENDERBUFFER_SIZE']
];
const RENDERER_INFO = 'WEBGL_debug_renderer_info';

function watchWebGl(): void {
  const seen = new WeakSet<object>();
  wrapOnce(HTMLCanvasElement.prototype as unknown as Wrappable, 'getContext', (original) =>
    function (this: HTMLCanvasElement, ...args: unknown[]) {
      const context = original.apply(this, args) as WebGLRenderingContext | null;
      const kind = String(args[0]);
      if (!context || !kind.startsWith('webgl') || seen.has(context)) {
        return context;
      }
      seen.add(context);
      const gl = context as unknown as Record<string, number> & WebGLRenderingContext;
      const facts: Props = { kind };
      GL_FACTS.forEach(([key, name]) => (facts[key] = gl.getParameter(gl[name])));
      const renderer = gl.getExtension(RENDERER_INFO);
      facts.renderer = renderer ? gl.getParameter(renderer.UNMASKED_RENDERER_WEBGL) : null;
      flightNote('webgl', facts);
      return context;
    }
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url, location.href).host;
  } catch {
    return '';
  }
};

function watchEntries(): () => void {
  const observers: PerformanceObserver[] = [];
  const observe = (type: string, onEntry: (e: PerformanceEntry) => void) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach(onEntry));
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      return;
    }
  };

  observe('resource', (e) => {
    const r = e as PerformanceResourceTiming & { responseStatus?: number };
    const bytes = r.transferSize || r.encodedBodySize;
    const ms = Math.round(r.responseEnd - r.startTime);
    if (SOURCES.test(r.name)) {
      flightNote('sources', { frames: new URL(r.name, location.href).searchParams.get('ids')?.split(',').length ?? 1, bytes, ms, status: r.responseStatus ?? null });
      return;
    }
    if (bytes >= BIG_RESOURCE_BYTES || (r.responseStatus ?? 0) >= 400) {
      flightNote('asset', { host: hostOf(r.name), initiator: r.initiatorType, bytes, decoded: r.decodedBodySize, ms, status: r.responseStatus ?? null });
    }
  });

  observe('mark', (e) => {
    const [kind, step, group = ''] = e.name.split('|');
    if (kind === 'startup') {
      flightNote('startup', { step, at: Math.round(e.startTime) });
      return;
    }
    if (kind === 'frame' && FRAME_STEPS.has(step)) {
      flightNote('frame', { step, id: group.split(':')[0], at: Math.round(e.startTime) });
    }
  });

  observe('longtask', (e) => flightNote('long-task', { ms: Math.round(e.duration) }));

  return () => observers.forEach((o) => o.disconnect());
}

type FrameCount = { at: number; ms: number; tiles: number; draws: number; moving: boolean };

function frameStats(since: number): { stats: Props; last: number } {
  const frames = (window as Window & { __gpuCanvas?: { frames?: FrameCount[] } }).__gpuCanvas?.frames ?? [];
  let n = 0;
  let worst = 0;
  let gap = 0;
  let tiles = 0;
  let draws = 0;
  let later = Infinity;
  for (let i = frames.length - 1; i >= 0 && frames[i].at > since; i--) {
    const f = frames[i];
    n++;
    worst = Math.max(worst, f.ms);
    tiles += f.tiles;
    draws = n === 1 ? f.draws : draws;
    if (later !== Infinity) {
      gap = Math.max(gap, later - f.at);
    }
    later = f.at;
  }
  const last = frames.length ? frames[frames.length - 1].at : since;
  return { stats: { painted: n, worstMs: worst, gapMs: gap, tiles, draws }, last };
}

function heapBytes(): number | null {
  return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
}

const pinchDistance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

export function startFlight(place: FlightPlace, env: FlightEnv = browserEnv()): Flight | null {
  if (!env.tab || active || !flightWanted(env.search, env.tab)) {
    return null;
  }
  const tab = env.tab;
  const session = crypto.randomUUID().replace(/-/g, '').slice(0, SESSION_CHARS);
  const previous = openMark(tab, session);
  const log = createFlightLog({ clock: () => performance.now(), send: poster(session, place.canvasId) });
  active = { log, counts: new Map() };

  flightNote('start', { ...deviceFacts(), device: place.device, previous });
  watchAdapters();
  watchWebGl();
  probeGpu(window as never).watch = (bytes, change) => bytes >= BIG_TEXTURE_BYTES && flightNote('texture', { change, bytes });
  const unobserve = watchEntries();
  log.flush(Send.Fetch);

  const touch = { count: 0, from: 0, scale: 1, wheels: 0, lastWheel: -Infinity };
  const gesture = (props: Props) => {
    flightNote('gesture', props);
    flushNow();
  };

  const listeners: [EventTarget, string, (e: Event) => void][] = [
    [window, 'touchstart', (e) => {
      const t = (e as TouchEvent).touches;
      touch.count = t.length;
      touch.from = t.length === 2 ? pinchDistance(t) : touch.from;
      gesture({ phase: 'start', input: 'touch', touches: t.length });
    }],
    [window, 'touchmove', (e) => {
      const t = (e as TouchEvent).touches;
      if (t.length === 2 && touch.from) {
        touch.scale = pinchDistance(t) / touch.from;
      }
    }],
    [window, 'touchend', (e) => {
      touch.count = (e as TouchEvent).touches.length;
      gesture({ phase: 'end', input: 'touch', touches: touch.count, scale: finite(touch.scale) });
      if (!touch.count) {
        touch.scale = 1;
        touch.from = 0;
      }
    }],
    [window, 'touchcancel', () => gesture({ phase: 'cancel', input: 'touch' })],
    [window, 'wheel', (e) => {
      const now = performance.now();
      touch.wheels++;
      if (now - touch.lastWheel > WHEEL_QUIET_MS) {
        gesture({ phase: 'start', input: (e as WheelEvent).ctrlKey ? 'pinch-wheel' : 'wheel' });
      }
      touch.lastWheel = now;
    }],
    [window, 'pointerdown', (e) => {
      const p = e as PointerEvent;
      if (p.pointerType !== 'touch') {
        gesture({ phase: 'start', input: p.pointerType, button: p.button });
      }
    }],
    [window, 'error', (e) => {
      const err = e as ErrorEvent;
      flightNote('error', { message: err.message, at: `${err.filename ? hostOf(err.filename) : ''}:${err.lineno}:${err.colno}`, stack: err.error?.stack ?? null });
      flushNow();
    }],
    [window, 'unhandledrejection', (e) => {
      const reason = (e as PromiseRejectionEvent).reason;
      flightNote('rejection', { message: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? (reason.stack ?? null) : null });
      flushNow();
    }],
    [window, 'webglcontextlost', () => {
      flightNote('context-lost');
      flushNow();
    }],
    [window, 'webglcontextrestored', () => flightNote('context-restored')],
    [document, 'visibilitychange', () => {
      flightNote('visibility', { state: document.visibilityState });
      closeMark(tab, session, log.last(), document.visibilityState === 'hidden');
      log.flush(document.visibilityState === 'hidden' ? Send.Beacon : Send.Fetch);
    }],
    [window, 'pagehide', (e) => {
      flightNote('pagehide', { persisted: (e as PageTransitionEvent).persisted });
      closeMark(tab, session, log.last(), true);
      log.flush(Send.Beacon);
    }],
    [window, 'pageshow', (e) => {
      flightNote('pageshow', { persisted: (e as PageTransitionEvent).persisted });
      closeMark(tab, session, log.last(), false);
    }],
    [window, 'resize', () => flightNote('resize', { size: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio })],
    [window, 'orientationchange', () => flightNote('orientation', { angle: screen.orientation?.angle ?? null })]
  ];
  const options = { capture: true, passive: true };
  listeners.forEach(([target, type, listener]) => target.addEventListener(type, listener, options));

  let previousSample: Props | null = null;
  let lastSampleAt = -Infinity;
  let lastFrameAt = performance.now();
  let tickAt = performance.now();
  let heap = heapBytes();
  let heapAt = tickAt;
  let selfMs = 0;
  let readMs = 0;
  const timed = (run: () => void) => () => {
    const from = performance.now();
    run();
    selfMs += performance.now() - from;
  };

  const sample = () => {
    const now = performance.now();
    const lag = Math.max(0, now - tickAt - SAMPLE_MS);
    tickAt = now;
    if (now - heapAt > HEAP_EVERY_MS) {
      heap = heapBytes();
      heapAt = now;
    }
    const { stats, last } = frameStats(lastFrameAt);
    lastFrameAt = last;
    const readFrom = performance.now();
    const read = place.read();
    readMs += performance.now() - readFrom;
    const snapshot = numbers({ ...read, touches: touch.count, scale: touch.scale, wheels: touch.wheels, heap, ...stats });
    if (!changed(previousSample, snapshot) && now - lastSampleAt < HEARTBEAT_MS && lag < NOTABLE_LAG_MS) {
      return;
    }
    previousSample = snapshot;
    lastSampleAt = now;
    flightNote('sample', { ...snapshot, lag: Math.round(lag), selfMs: finite(selfMs), readMs: finite(readMs) });
    selfMs = 0;
    readMs = 0;
  };

  const sampling = setInterval(timed(sample), SAMPLE_MS);
  const flushing = setInterval(
    timed(() => {
      log.flush(Send.Fetch);
      closeMark(tab, session, log.last(), false);
    }),
    FLUSH_MS
  );

  return {
    session,
    previous,
    stop() {
      flightNote('stop');
      log.flush(Send.Fetch);
      closeMark(tab, session, log.last(), true);
      clearInterval(sampling);
      clearInterval(flushing);
      unobserve();
      listeners.forEach(([target, type, listener]) => target.removeEventListener(type, listener, options));
      probeGpu(window as never).watch = undefined;
      active = null;
    }
  };
}

