const MB = 1024 * 1024;
const P95 = 0.95;
const MISSING = 'n/a';

export type RawRun = { inputs: { input: number; paint: number }[]; frames: number[]; firstPaintMs: number; heapBytes: number | null };
export type Summary = { inputP95: number | null; frameP95: number | null; firstPaintMs: number; heapMb: number | null };
export type Row = { browser: string; renderer: string; summary: Summary };

function p95(xs: number[]): number | null {
  if (!xs.length) {
    return null;
  }
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * P95))];
}

export function summarise(run: RawRun): Summary {
  return {
    inputP95: p95(run.inputs.map((i) => i.paint - i.input)),
    frameP95: p95(run.frames),
    firstPaintMs: Math.round(run.firstPaintMs),
    heapMb: run.heapBytes === null ? null : Math.round(run.heapBytes / MB)
  };
}

const cell = (v: number | null) => (v === null ? MISSING : String(Math.round(v)));

export function comparison(rows: Row[]): string {
  const head = '| browser | renderer | input→paint p95 ms | frame p95 ms | first full paint ms | JS heap MB |\n|---|---|---|---|---|---|';
  const body = rows.map(({ browser, renderer, summary: s }) => `| ${browser} | ${renderer} | ${cell(s.inputP95)} | ${cell(s.frameP95)} | ${cell(s.firstPaintMs)} | ${cell(s.heapMb)} |`);
  return [head, ...body].join('\n');
}
