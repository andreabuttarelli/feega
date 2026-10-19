const KEEP = 600;

export type TextureReport = { count: number; bytes: number; largest: string[] };

type Stats = { render: number[]; textures?: () => TextureReport; pending?: number; loseDevice?: () => void; counts?: Record<string, number>; reveal?: { ms: number; missing: string[] }; settled?: number };

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
