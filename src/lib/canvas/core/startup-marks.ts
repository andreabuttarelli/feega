const PREFIX = 'startup|';
export const STARTUP_EVENT = 'feega:startup';
export const FRAMES_SHOWN_EVENT = 'feega:frames-shown';

export enum StartupStep {
  PageData = 'page-data',
  RendererChunk = 'renderer-chunk',
  WasmAsked = 'wasm-asked',
  WasmReady = 'wasm-ready',
  Mounted = 'core-mounted',
  GpuAsked = 'gpu-asked',
  GpuReady = 'gpu-ready',
  WorkerSpawned = 'worker-spawned',
  WorkerReady = 'worker-ready',
  SourcesAsked = 'sources-asked',
  SourcesArrived = 'sources-arrived',
  FirstBuilt = 'first-built',
  FirstDrawn = 'first-drawn',
  AllShown = 'all-shown'
}

export function reportFramesShown(shown: number, total: number) {
  globalThis.dispatchEvent?.(new CustomEvent(FRAMES_SHOWN_EVENT, { detail: { shown, total } }));
  if (shown === total) {
    markStartup(StartupStep.AllShown);
  }
}

export type StartupMark = { step: StartupStep; at: number };

type Mark = { name: string; startTime: number };
type Resource = { name: string; startTime: number; responseEnd: number };

const RESOURCES: { step: string; matches: (url: string) => boolean }[] = [
  { step: 'wasm-fetch', matches: (u) => /gpu_core(_gl)?_bg\.wasm/.test(u) },
  { step: 'font-fetch', matches: (u) => /\.(woff2?|ttf|otf)(\?|$)/.test(u) },
  { step: 'sources-fetch', matches: (u) => /\/motion\/sources\?/.test(u) },
  { step: 'worker-fetch', matches: (u) => u.includes('frame-build.worker') }
];

export function markStartup(step: StartupStep) {
  if (typeof performance === 'undefined' || performance.getEntriesByName(`${PREFIX}${step}`, 'mark').length) {
    return;
  }
  performance.mark(`${PREFIX}${step}`);
  globalThis.dispatchEvent?.(new CustomEvent(STARTUP_EVENT, { detail: step }));
}

export function startupMarks(marks: readonly Mark[]): StartupMark[] {
  return marks
    .filter((m) => m.name.startsWith(PREFIX))
    .map((m) => ({ step: m.name.slice(PREFIX.length) as StartupStep, at: Math.round(m.startTime) }))
    .sort((a, b) => a.at - b.at);
}

export type Span = { step: string; start: number; end: number };

export function resourceSpans(resources: readonly Resource[]): Span[] {
  return RESOURCES.flatMap(({ step, matches }) => {
    const hits = resources.filter((r) => matches(r.name));
    return hits.length ? [{ step, start: Math.round(Math.min(...hits.map((h) => h.startTime))), end: Math.round(Math.max(...hits.map((h) => h.responseEnd))) }] : [];
  });
}

export function startupWaterfall(marks: readonly Mark[], resources: readonly Resource[]): string {
  const points = startupMarks(marks).map((m) => `${String(m.at).padStart(6)}  ${m.step}`);
  const spans = resourceSpans(resources).map((s) => `${String(s.start).padStart(6)}–${s.end}  ${s.step}`);
  return [...points, ...spans].join('\n');
}
