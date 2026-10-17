const KEEP = 600;

type Stats = { render: number[] };

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
