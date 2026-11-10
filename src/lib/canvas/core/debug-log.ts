export const DEBUG_STORAGE_KEY = 'feega:debug';

const PREFIX = '[feega]';
const PARAM = 'debug';
const ON = '1';
const LONG_FRAME_MS = 32;
const GESTURE_END_MS = 150;

export type Sink = { line: (text: string) => void; open: (text: string) => void; close: () => void };
type Mark = { name: string; startTime: number };

const consoleSink: Sink = { line: (t) => console.log(t), open: (t) => console.groupCollapsed(t), close: () => console.groupEnd() };

const FRAME_TAGS: Record<string, string> = {
  asked: 'sources',
  source: 'sources',
  built: 'build',
  'main-asked': 'build',
  'main-build': 'build',
  'main-built': 'build',
  vectors: 'build',
  whole: 'build',
  'all-vectors': 'build',
  put: 'upload',
  patched: 'upload',
  pictured: 'raster',
  drawn: 'raster',
  sharp: 'raster',
  thumb: 'posters',
  images: 'images'
};

const line = (tag: string, at: number, text: string) => `${PREFIX} [${tag}] ${String(Math.round(at)).padStart(6)}ms ${text}`;

function readStored(): string | null {
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export const debugOn = (search: string, stored: string | null) => new URLSearchParams(search).has(PARAM) || stored === ON;

const enabled = () => debugOn(typeof location === 'undefined' ? '' : location.search, readStored());

export function formatMark({ name, startTime }: Mark): string | null {
  const [kind, step, group] = name.split('|');
  if (kind === 'startup') {
    return line('startup', startTime, step);
  }
  if (kind === 'frame') {
    return line(FRAME_TAGS[step] ?? 'build', startTime, `${group} ${step}`);
  }
  return null;
}

function watch(type: string, onEntry: (e: PerformanceEntry) => void) {
  try {
    new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true });
  } catch {
    return;
  }
}

function sourcesLine(r: PerformanceResourceTiming): string {
  const phases = (r.serverTiming ?? []).map((t) => `${t.name}=${Math.round(t.duration)}`).join(' ');
  const bytes = r.transferSize || r.encodedBodySize;
  return line('sources', r.responseEnd, `${new URL(r.name, 'http://x').searchParams.get('ids')?.split(',').length ?? 1} frames ${bytes}B ${Math.round(r.responseEnd - r.startTime)}ms ${phases}`.trim());
}

let started = false;

export function debugStart(search: string = typeof location === 'undefined' ? '' : location.search, sink: Sink = consoleSink): boolean {
  if (!debugOn(search, readStored())) {
    return false;
  }
  if (started) {
    return true;
  }
  started = true;
  watch('mark', (e) => {
    const text = formatMark(e);
    if (text) {
      sink.line(text);
    }
  });
  watch('resource', (e) => {
    if (/\/motion\/sources\?/.test(e.name)) {
      sink.line(sourcesLine(e as PerformanceResourceTiming));
    }
  });
  return true;
}

type Gesture = { name: string; lastAt: number; timer: ReturnType<typeof setTimeout> | 0 };
let gesture: Gesture | null = null;

export function gestureLog(name: string, sink: Sink = consoleSink, search: string = typeof location === 'undefined' ? '' : location.search) {
  if (!debugOn(search, readStored())) {
    return;
  }
  if (gesture) {
    clearTimeout(gesture.timer || undefined);
    gesture.timer = setTimeout(() => endGesture(sink), GESTURE_END_MS);
    return;
  }
  const current: Gesture = { name, lastAt: 0, timer: setTimeout(() => endGesture(sink), GESTURE_END_MS) };
  gesture = current;
  sink.line(line('camera', performance.now(), `${name} start`));
  const tick = (now: number) => {
    if (gesture !== current) {
      return;
    }
    if (current.lastAt && now - current.lastAt > LONG_FRAME_MS) {
      sink.line(line('camera', now, `long frame ${Math.round(now - current.lastAt)}ms during ${name}`));
    }
    current.lastAt = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function endGesture(sink: Sink) {
  if (gesture) {
    sink.line(line('camera', performance.now(), `${gesture.name} end`));
  }
  gesture = null;
}
