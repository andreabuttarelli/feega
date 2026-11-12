const KEEP = 600;
const FRAMES_KEPT = 2400;

export type CoreFrameCount = { at: number; ms: number; moving: boolean; plans: number; walked: number; planMs: number; bakes: number; bakeMs: number; uploadBytes: number; unsharp: number; uncovered: number; step: number; pending: boolean; camera?: FrameCamera };

export type FrameCamera = { x: number; y: number; zoom: number };

export type TextureReport = { count: number; bytes: number; largest: string[] };

type Tally = Record<string, { n: number; ms: number }>;

type Stats = { render: number[]; textures?: () => TextureReport; pending?: number; loseDevice?: () => void; counts?: Record<string, number>; tally?: Tally; reveal?: { ms: number; missing: string[] }; settled?: number; frames?: CoreFrameCount[]; marks?: StatsMarks };

export type StatsMarks = { hit: (x: number, y: number) => { id: string; part: number; n: number } | null; rectOf: (id: string) => { x: number; y: number; w: number; h: number } | null; ids: () => string[] };

declare global {
  interface Window {
    __gpuCanvas?: Stats;
  }
}

export function recordFrame(ms: number) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  stats.render.push(ms);
  if (stats.render.length > KEEP) {
    stats.render.shift();
  }
}

export function reportPending(count: number) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  stats.pending = count;
}

export function exposeReveal(ms: number, missing: string[]) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  stats.reveal = { ms, missing };
}

export function exposeSettled(ms: number) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  stats.settled = ms;
}

export function exposeMarks(marks: StatsMarks | undefined) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  stats.marks = marks;
}

export function exposeLoss(lose: () => void) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  stats.loseDevice = lose;
}

export enum Counter {
  Build = 'build',
  Fetch = 'fetch',
  Upload = 'upload',
  Snapshot = 'snapshot',
  CachedSnapshot = 'cached-snapshot'
}

export function count(name: Counter) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  const counts = (stats.counts ??= {});
  counts[name] = (counts[name] ?? 0) + 1;
}

export function exposeTextures(report: () => TextureReport) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  stats.textures = report;
}

export function addTally(json: string) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  const tally = (stats.tally ??= {});
  for (const [reason, { n, ms }] of Object.entries(JSON.parse(json) as Tally)) {
    const sum = (tally[reason] ??= { n: 0, ms: 0 });
    sum.n += n;
    sum.ms += ms;
  }
}

export function countFrame(began: number, counts: Float64Array | undefined, moving: boolean, pending: boolean, camera?: FrameCamera) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  const frames = (stats.frames ??= []);
  const [plans = 0, walked = 0, planMs = 0, bakes = 0, bakeMs = 0, uploadBytes = 0, unsharp = 0, uncovered = 0, step = 0] = counts ?? [];
  frames.push({ at: began, ms: performance.now() - began, moving, plans, walked, planMs, bakes, bakeMs, uploadBytes, unsharp, uncovered, step, pending, camera });
  if (frames.length > FRAMES_KEPT) {
    frames.shift();
  }
}
