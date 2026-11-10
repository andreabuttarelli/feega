export const DEBUG_STORAGE_KEY = 'feega:debug';

const PREFIX = '[feega]';
const PARAM = 'debug';
const ON = '1';
const LONG_FRAME_MS = 32;
const GESTURE_END_MS = 150;
const GROUP_MAX = 40;

export type Sink = { line: (text: string) => void; group: (title: string, lines: string[]) => void };
type Mark = { name: string; startTime: number };

const consoleSink: Sink = {
  line: (t) => console.log(t),
  group: (title, lines) => {
    console.groupCollapsed(title);
    lines.forEach((l) => console.log(l));
    console.groupEnd();
  }
};

const FLUSH_MS = 100;

type Entry = { at: number; text: string; lines?: string[] };

export function ordered(sink: Sink, later: (flush: () => void) => void = (f) => void setTimeout(f, FLUSH_MS)): { push: (at: number, text: string, lines?: string[]) => void; flush: () => void } {
  let held: Entry[] = [];
  const flush = () => {
    const batch = held.sort((a, b) => a.at - b.at);
    held = [];
    batch.forEach((e) => (e.lines ? sink.group(e.text, e.lines) : sink.line(e.text)));
  };
  return {
    push: (at, text, lines) => {
      held.push({ at, text, lines });
      if (held.length === 1) {
        later(flush);
      }
    },
    flush
  };
}

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
    return line(FRAME_TAGS[step] ?? 'build', startTime, `${group.slice(0, GROUP_MAX)} ${step}`);
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

type Step = { step: string; at: number };

const CHAIN = ['asked', 'source', 'built', 'put', 'drawn'];

export function frameSummary(id: string, steps: readonly Step[]): { title: string; lines: string[] } {
  const first = new Map<string, number>();
  steps.forEach((s) => first.set(s.step, Math.min(first.get(s.step) ?? Infinity, s.at)));
  const present = CHAIN.filter((c) => first.has(c));
  const lines = present.slice(1).map((c, i) => `${present[i]} -> ${c} ${Math.round(first.get(c)! - first.get(present[i])!)}ms`);
  const total = present.length > 1 ? Math.round(first.get(present[present.length - 1])! - first.get(present[0])!) : 0;
  return { title: line('raster', first.get('drawn') ?? 0, `${id} drawn, ${total}ms from ${present[0]}`), lines };
}

export type RenderSample = { at: number; outcome: string; tally: string; cacheBytes: number; pending: boolean; moving: boolean };

export function renderEvents(prev: RenderSample | null, now: RenderSample): string[] {
  const out: string[] = [];
  if (prev && prev.moving && !now.moving) {
    out.push(line('tiles', now.at, 'gesture end, rest render start'));
  }
  if (prev && !prev.moving && now.moving) {
    out.push(line('tiles', now.at, 'gesture render start'));
  }
  const passes = JSON.parse(now.tally || '{}') as Record<string, { n: number; ms: number }>;
  const raster = Object.entries(passes).filter(([, v]) => v.n > 0).map(([k, v]) => `${k}=${v.n}/${v.ms.toFixed(1)}ms`);
  if (raster.length) {
    out.push(line('tiles', now.at, `${now.moving ? 'gesture' : 'rest'} frame ${now.outcome} ${raster.join(' ')}`));
  }
  if (prev && now.cacheBytes < prev.cacheBytes) {
    out.push(line('tiles', now.at, `evicted ${prev.cacheBytes - now.cacheBytes}B (cache ${now.cacheBytes}B)`));
  }
  if (prev && prev.pending && !now.pending) {
    out.push(line('tiles', now.at, 'settled'));
  }
  return out;
}

type Out = ReturnType<typeof ordered>;
let out: Out | null = null;
let prevSample: RenderSample | null = null;
let lastTier: string | null = null;
const frames = new Map<string, Step[]>();
const summarised = new Set<string>();

const THUMB = ':thumb';
const STAND_IN = ':[';

function onMark(e: Mark) {
  const text = formatMark(e);
  if (!text) {
    return;
  }
  out!.push(e.startTime, text);
  const [kind, step, group] = e.name.split('|');
  if (kind !== 'frame' || group === 'all' || group.endsWith(THUMB) || group.includes(STAND_IN)) {
    return;
  }
  const id = group.split(':')[0];
  const steps = frames.get(id) ?? frames.set(id, []).get(id)!;
  steps.push({ step, at: e.startTime });
  if (step === 'drawn' && !summarised.has(id)) {
    summarised.add(id);
    const { title, lines } = frameSummary(id, steps);
    out!.push(e.startTime, title, lines);
  }
}

export function debugStart(search: string = typeof location === 'undefined' ? '' : location.search, sink: Sink = consoleSink): boolean {
  if (!debugOn(search, readStored())) {
    return false;
  }
  if (out) {
    return true;
  }
  out = ordered(sink);
  watch('mark', onMark);
  watch('resource', (e) => {
    if (/\/motion\/sources\?/.test(e.name)) {
      out!.push(e.responseEnd, sourcesLine(e as PerformanceResourceTiming));
    }
  });
  return true;
}

export function debugStop() {
  out = null;
  prevSample = null;
  lastTier = null;
  gesture = null;
  frames.clear();
  summarised.clear();
}

export const debugActive = () => out !== null;

export function renderLog(now: RenderSample) {
  if (!out) {
    return;
  }
  renderEvents(prevSample, now).forEach((text) => out!.push(now.at, text));
  prevSample = now;
}

export function tierLog(tier: string, zoom: number) {
  if (!out || tier === lastTier) {
    return;
  }
  const text = lastTier ? `tier ${lastTier} -> ${tier} at zoom ${zoom.toFixed(3)}` : `tier ${tier} at zoom ${zoom.toFixed(3)}`;
  lastTier = tier;
  out.push(performance.now(), line('images', performance.now(), text));
}

type Gesture = { name: string; lastAt: number; timer: ReturnType<typeof setTimeout> | 0 };
let gesture: Gesture | null = null;

export function gestureLog(name: string) {
  if (!out) {
    return;
  }
  if (gesture) {
    clearTimeout(gesture.timer || undefined);
    gesture.timer = setTimeout(endGesture, GESTURE_END_MS);
    return;
  }
  const current: Gesture = { name, lastAt: 0, timer: setTimeout(endGesture, GESTURE_END_MS) };
  gesture = current;
  out.push(performance.now(), line('camera', performance.now(), `${name} start`));
  const tick = (now: number) => {
    if (gesture !== current) {
      return;
    }
    if (current.lastAt && now - current.lastAt > LONG_FRAME_MS) {
      out!.push(now, line('camera', now, `long frame ${Math.round(now - current.lastAt)}ms during ${name}`));
    }
    current.lastAt = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function endGesture() {
  if (gesture && out) {
    out.push(performance.now(), line('camera', performance.now(), `${gesture.name} end`));
  }
  gesture = null;
}
