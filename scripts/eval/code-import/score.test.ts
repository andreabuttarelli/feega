import { describe, expect, it } from 'vitest';
import { failureHistogram, Metric, scoreRepo, unrunOf, type ImportRun } from './score';
import type { CorpusEntry } from './corpus';

const ENTRY: CorpusEntry = {
  name: 'demo',
  repo: 'acme/demo',
  sha: 'abc',
  licence: 'MIT',
  framework: 'sveltekit',
  app: '',
  expectedRoutes: ['/', '/about', '/blog/[slug]'],
  routes: ['/', '/about'],
  conditions: [{ scheme: 'light', width: 1280 } as never, { scheme: 'dark', width: 390 } as never],
  componentFiles: 10,
  thresholds: { routeSuccess: 1, componentCoverage: 0.5, bindRate: 0.5, fidelity: 0.9 }
};

const RUN: ImportRun = {
  boot: { ok: true, installMs: 30_000, readyMs: 8_000 },
  discovered: null,
  routes: [
    { route: '/', condition: 'base', ok: true },
    { route: '/', condition: 'dark·390', ok: true },
    { route: '/about', condition: 'base', ok: false, failure: 'not_landed' },
    { route: '/about', condition: 'dark·390', ok: false, failure: 'not_landed' }
  ],
  components: 4,
  variants: 6,
  instances: 9,
  uses: null,
  tokens: 12,
  bound: { byClass: 6, byRule: 1, byValue: 1, unbound: 2 },
  fidelity: [
    { route: '/', condition: 'base', ssim: 0.96 },
    { route: '/', condition: 'dark·390', ssim: 0.9 }
  ],
  phases: { request: 50_000 },
  sandboxMs: 60_000
};

describe('the code import scorecard', () => {
  it('marks every metric unrun with the reason when nothing ran', () => {
    const card = scoreRepo(ENTRY, null, 'dry run');

    expect(Object.values(card.metrics).every((m) => 'unrun' in m && m.unrun === 'dry run')).toBe(true);
  });

  it('never reports route recall while discovery does not exist, but says which routes were typed', () => {
    const recall = scoreRepo(ENTRY, RUN).metrics[Metric.RouteRecall];

    expect(recall).toMatchObject({ unrun: expect.stringContaining('discovery') });
    expect(recall).toMatchObject({ typed: 2, expected: 3 });
  });

  it('measures recall against the file-router tree once discovery returns routes', () => {
    const recall = scoreRepo(ENTRY, { ...RUN, discovered: ['/', '/blog/[slug]', '/extra'] }).metrics[Metric.RouteRecall];

    expect(recall).toMatchObject({ value: 2 / 3 });
  });

  it('counts route success per route × condition and groups failures by cause', () => {
    expect(scoreRepo(ENTRY, RUN).metrics[Metric.RouteSuccess]).toEqual({ value: 0.5, failures: { not_landed: 2 } });
  });

  it('divides imported sets by component files in the repo', () => {
    expect(scoreRepo(ENTRY, RUN).metrics[Metric.Components]).toMatchObject({ value: 0.4 });
  });

  it('leaves component coverage unrun when the counting rule finds no file', () => {
    expect(scoreRepo({ ...ENTRY, componentFiles: 0 }, RUN).metrics[Metric.Components]).toMatchObject({ unrun: expect.any(String) });
  });

  it('leaves variant coverage unrun without declared axes', () => {
    expect(scoreRepo(ENTRY, RUN).metrics[Metric.Variants]).toMatchObject({ unrun: expect.any(String) });
    expect(scoreRepo({ ...ENTRY, declaredVariants: 12 }, RUN).metrics[Metric.Variants]).toMatchObject({ value: 0.5 });
  });

  it('needs the use count to rate linked instances', () => {
    expect(scoreRepo(ENTRY, RUN).metrics[Metric.Linked]).toMatchObject({ unrun: expect.any(String) });
    expect(scoreRepo(ENTRY, { ...RUN, uses: 18 }).metrics[Metric.Linked]).toMatchObject({ value: 0.5 });
  });

  it('rates bound values over every value the binder saw', () => {
    expect(scoreRepo(ENTRY, RUN).metrics[Metric.Bind]).toMatchObject({ value: 0.8 });
  });

  it('averages fidelity across route × condition and keeps the worst pair', () => {
    expect(scoreRepo(ENTRY, RUN).metrics[Metric.Fidelity]).toMatchObject({ value: expect.closeTo(0.93), worst: { route: '/', condition: 'dark·390', ssim: 0.9 } });
  });

  it('turns a boot failure into the cause and leaves what depends on a running app unrun', () => {
    const card = scoreRepo(ENTRY, { ...RUN, boot: { ok: false, failure: 'install_failed', detail: 'ERR_PNPM' }, routes: [], components: null, fidelity: null });

    expect(card.metrics[Metric.Boot]).toEqual({ value: 0, failure: 'install_failed', detail: 'ERR_PNPM' });
    expect(card.metrics[Metric.RouteSuccess]).toMatchObject({ unrun: expect.stringContaining('boot') });
  });

  it('prices the sandbox from its wall time', () => {
    expect(scoreRepo(ENTRY, RUN).metrics[Metric.Cost]).toMatchObject({ value: expect.closeTo(0.00996, 4) });
  });

  it('lists unrun metrics with their reasons', () => {
    expect(unrunOf(scoreRepo(ENTRY, RUN))).toContainEqual({ metric: Metric.Variants, reason: expect.any(String) });
  });

  it('histograms failures across the corpus', () => {
    const failed = scoreRepo(ENTRY, { ...RUN, boot: { ok: false, failure: 'install_failed', detail: '' } });

    expect(failureHistogram([scoreRepo(ENTRY, RUN), failed])).toEqual({ install_failed: 1, not_landed: 2 });
  });
});
