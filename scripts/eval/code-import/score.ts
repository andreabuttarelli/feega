import { sandboxUsd } from '$lib/server/code-import/sandbox-runner';
import type { CorpusEntry } from './corpus';

export enum Metric {
  Boot = 'boot',
  RouteRecall = 'routeRecall',
  RouteSuccess = 'routeSuccess',
  Components = 'componentCoverage',
  Variants = 'variantCoverage',
  Linked = 'linkedInstances',
  Tokens = 'tokenCoverage',
  Bind = 'bindRate',
  Fidelity = 'fidelity',
  Time = 'wallTime',
  Cost = 'sandboxCost'
}

export type Boot = { ok: true; installMs: number | null; readyMs: number | null } | { ok: false; failure: string; detail: string };

export type RouteResult = { route: string; condition: string; ok: boolean; failure?: string };

export type Fidelity = { route: string; condition: string; ssim: number };

export type Bound = { byClass: number; byRule: number; byValue: number; unbound: number };

export type ImportRun = {
  boot: Boot;
  discovered: string[] | null;
  routes: RouteResult[];
  components: number | null;
  variants: number | null;
  instances: number | null;
  uses: number | null;
  tokens: number | null;
  bound: Bound | null;
  fidelity: Fidelity[] | null;
  phases: Record<string, number>;
  sandboxMs: number | null;
};

export type Measured = ({ value: number } | { unrun: string }) & Record<string, unknown>;

export type Scorecard = { name: string; repo: string; sha: string; metrics: Record<Metric, Measured> };

const NO_DISCOVERY = 'route discovery does not exist yet: routes are typed from the corpus';
const NOT_BOOTED = 'app did not boot';

const ratio = (part: number | null, whole: number | null | undefined, why: string): Measured => (part === null || !whole ? { unrun: why } : { value: part / whole });

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function recall(entry: CorpusEntry, run: ImportRun): Measured {
  const counts = { typed: entry.routes.length, expected: entry.expectedRoutes.length };
  if (!run.discovered) {
    return { unrun: NO_DISCOVERY, ...counts };
  }
  const found = new Set(run.discovered);
  return { value: entry.expectedRoutes.filter((r) => found.has(r)).length / entry.expectedRoutes.length, ...counts };
}

function success(run: ImportRun): Measured {
  if (!run.boot.ok) {
    return { unrun: NOT_BOOTED };
  }
  if (!run.routes.length) {
    return { unrun: 'no route was attempted' };
  }
  const failures: Record<string, number> = {};
  for (const r of run.routes.filter((x) => !x.ok)) {
    const cause = r.failure ?? 'unknown';
    failures[cause] = (failures[cause] ?? 0) + 1;
  }
  return { value: run.routes.filter((r) => r.ok).length / run.routes.length, failures };
}

function bindRate(bound: Bound | null): Measured {
  if (!bound) {
    return { unrun: 'import reported no design-system binding' };
  }
  const hit = bound.byClass + bound.byRule + bound.byValue;
  return ratio(hit, hit + bound.unbound, 'binder saw no value');
}

function fidelity(pairs: Fidelity[] | null): Measured {
  if (!pairs?.length) {
    return { unrun: 'no board render vs live screenshot pair was scored' };
  }
  const worst = pairs.reduce((a, b) => (b.ssim < a.ssim ? b : a));
  return { value: mean(pairs.map((p) => p.ssim)), worst };
}

function measured(entry: CorpusEntry, run: ImportRun): Record<Metric, Measured> {
  const boot: Measured = run.boot.ok ? { value: 1, installMs: run.boot.installMs, readyMs: run.boot.readyMs } : { value: 0, failure: run.boot.failure, detail: run.boot.detail };
  const totalMs = Object.values(run.phases).reduce((s, x) => s + x, 0);

  return {
    [Metric.Boot]: boot,
    [Metric.RouteRecall]: recall(entry, run),
    [Metric.RouteSuccess]: success(run),
    [Metric.Components]: ratio(run.components, entry.componentFiles, `no file matches the counting rule in ${entry.repo}`),
    [Metric.Variants]: ratio(run.variants, entry.declaredVariants, 'declared variant axes not counted for this repo'),
    [Metric.Linked]: ratio(run.instances, run.uses, 'import does not report component uses'),
    [Metric.Tokens]: { unrun: 'tokens declared in the repo are not counted: only the imported count is known', imported: run.tokens },
    [Metric.Bind]: bindRate(run.bound),
    [Metric.Fidelity]: fidelity(run.fidelity),
    [Metric.Time]: totalMs ? { value: totalMs, phases: run.phases } : { unrun: 'no phase timed' },
    [Metric.Cost]: run.sandboxMs === null ? { unrun: 'sandbox time unknown' } : { value: sandboxUsd(run.sandboxMs) }
  };
}

export function scoreRepo(entry: CorpusEntry, run: ImportRun | null, reason = 'not run'): Scorecard {
  const metrics = run ? measured(entry, run) : (Object.fromEntries(Object.values(Metric).map((m) => [m, { unrun: reason }])) as Record<Metric, Measured>);
  return { name: entry.name, repo: entry.repo, sha: entry.sha, metrics };
}

export const unrunOf = (card: Scorecard) => Object.entries(card.metrics).flatMap(([metric, m]) => ('unrun' in m ? [{ metric: metric as Metric, reason: m.unrun as string }] : []));

export function failureHistogram(cards: Scorecard[]): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (cause: string, n = 1) => (out[cause] = (out[cause] ?? 0) + n);
  for (const card of cards) {
    const boot = card.metrics[Metric.Boot];
    if (typeof boot.failure === 'string') {
      add(boot.failure);
      continue;
    }
    for (const [cause, n] of Object.entries((card.metrics[Metric.RouteSuccess].failures ?? {}) as Record<string, number>)) {
      add(cause, n);
    }
  }
  return out;
}
