export const METRICS = {
  fps: { label: 'zoom fps', better: 'higher' },
  p95: { label: 'p95 frame ms', better: 'lower' },
  worst: { label: 'worst frame ms', better: 'lower' },
  cpuMs: { label: 'main-thread CPU ms', better: 'lower' },
  sharpMs: { label: 'time-to-sharp ms', better: 'lower' }
};

export const mid = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
};

export const median = (runs) => Object.fromEntries(Object.keys(METRICS).map((key) => [key, mid(runs.map((r) => r[key]))]));

const SOFTWARE = /swiftshader|llvmpipe|software/i;

export const softwareAdapter = (info) => Boolean(info && SOFTWARE.test(`${info.vendor} ${info.architecture} ${info.description}`));
