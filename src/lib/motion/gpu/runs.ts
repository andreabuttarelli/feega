import { WEBGL_CONTEXT_BUDGET, WEBGL_PAGE_CONTEXTS } from '../export/webgl-budget';
import { PaintKind } from './paint-of';

export type Run = { clips: string[]; after: number; blend: string };

type Layered = { clip: string; paint: { kind: PaintKind }; blend: string };

const NORMAL = 'normal';

export function runsOf(layers: readonly Layered[]): Run[] {
  const runs: Run[] = [];
  let open: Run | null = null;
  layers.forEach((layer, index) => {
    if (layer.paint.kind !== PaintKind.Html) {
      open = null;
      return;
    }
    if (open && layer.blend === NORMAL && open.blend === NORMAL) {
      open.clips.push(layer.clip);
      return;
    }
    open = { clips: [layer.clip], after: index, blend: layer.blend };
    runs.push(open);
  });
  return runs;
}

const selector = (clips: readonly string[]) => clips.map((c) => `[data-clip="${c}"]`).join(',');

export function runHtml(page: string, run: Run, painted: readonly string[]): string {
  const others = painted.filter((c) => !run.clips.includes(c));
  const rules = ['#root{background:transparent!important}', others.length ? `${selector(others)}{display:none!important}` : '', run.blend === NORMAL ? '' : `${selector(run.clips)}{mix-blend-mode:normal!important}`];
  return page.replace('</head>', `<style>${rules.join('')}</style></head>`);
}

const GPU_CONTEXTS = 1;

export function gpuEligible(runs: readonly Run[], webglPerRun: number): boolean {
  return runs.length * webglPerRun + GPU_CONTEXTS <= WEBGL_CONTEXT_BUDGET - WEBGL_PAGE_CONTEXTS;
}
