const KEEP = 600;

type Stats = { render: number[]; pending?: number; loseDevice?: () => void };

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

export function exposeLoss(lose: () => void) {
  const stats = (window.__gpuCanvas ??= { render: [] });
  stats.loseDevice = lose;
}
