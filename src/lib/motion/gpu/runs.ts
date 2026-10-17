import { WEBGL_CONTEXT_BUDGET, WEBGL_PAGE_CONTEXTS } from '../export/webgl-budget';
import { PaintKind } from './paint-of';

export type Span = [number, number];

export type Run = { clips: string[]; after: number; blend: string; span: Span };

type Layered = { clip: string; paint: { kind: PaintKind }; blend: string; windows: Span[]; covers?: string[] };

function spanOf(windows: Span[]): Span {
  return windows.length ? [Math.max(...windows.map((w) => w[0])), Math.min(...windows.map((w) => w[1]))] : [0, Number.POSITIVE_INFINITY];
}

const joined = (a: Span, b: Span): Span => [Math.min(a[0], b[0]), Math.max(a[1], b[1])];

const NORMAL = 'normal';

export function runsOf(layers: readonly Layered[]): Run[] {
  const runs: Run[] = [];
  let open: Run | null = null;
  layers.forEach((layer, index) => {
    if (layer.paint.kind !== PaintKind.Html) {
      open = null;
      return;
    }
    const span = spanOf(layer.windows);
    if (open && layer.blend === NORMAL && open.blend === NORMAL) {
      open.clips.push(...(layer.covers ?? [layer.clip]));
      open.span = joined(open.span, span);
      return;
    }
    open = { clips: [...(layer.covers ?? [layer.clip])], after: index, blend: layer.blend, span };
    runs.push(open);
  });
  return runs;
}

const selector = (clips: readonly string[]) => clips.map((c) => `[data-clip="${c}"]`).join(',');

export function runHtml(page: string, run: Run): string {
  const rules = ['#root{background:transparent!important}', run.blend === NORMAL ? '' : `${selector(run.clips)}{mix-blend-mode:normal!important}`];
  return page.replace('</head>', `<style>${rules.join('')}</style></head>`);
}

const GPU_CONTEXTS = 1;
const MAX_CAPTURES = 2;

function peak(runs: readonly Run[], weight: (i: number) => number): number {
  const edges = runs.flatMap((r, i) => [[r.span[0], weight(i)], [r.span[1], -weight(i)]] as [number, number][]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let most = 0;
  for (const [, delta] of edges) {
    now += delta;
    most = Math.max(most, now);
  }
  return most;
}

export function gpuEligible(runs: readonly Run[], webglPerRun: readonly number[]): boolean {
  const captures = peak(runs, () => 1);
  const contexts = peak(runs, (i) => webglPerRun[i]) + GPU_CONTEXTS;
  return captures <= MAX_CAPTURES && contexts <= WEBGL_CONTEXT_BUDGET - WEBGL_PAGE_CONTEXTS;
}
