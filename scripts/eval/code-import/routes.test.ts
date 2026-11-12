import { describe, expect, it } from 'vitest';
import { discoverRoutes } from '$lib/server/code-import/routes-discover';
import { Framework } from '$lib/server/code-import/run-plan';
import { nextPlayground, nextShadcnAdmin, nuxtDashboard, saasStarter, shadcnAdmin, svgl, traidue, vitesse } from '$lib/server/code-import/routes-discover.fixtures';
import { CORPUS } from './corpus';
import { Metric, scoreRepo, type ImportRun } from './score';

const TREES: Record<string, { files: string[]; framework: Framework; missed: string[] }> = {
  traidue: { files: traidue, framework: Framework.SvelteKit, missed: [] },
  'next-shadcn-admin': { files: nextShadcnAdmin, framework: Framework.Next, missed: [] },
  'shadcn-admin': { files: shadcnAdmin, framework: Framework.Vite, missed: [] },
  'nuxt-dashboard': { files: nuxtDashboard, framework: Framework.Nuxt, missed: [] },
  'saas-starter': { files: saasStarter, framework: Framework.Next, missed: [] },
  'next-playground': { files: nextPlayground, framework: Framework.Next, missed: ['/[section]', '/[section]/[category]', '/active-links', '/breadcrumbs', '/search-params'] },
  svgl: { files: svgl, framework: Framework.SvelteKit, missed: [] },
  vitesse: { files: vitesse, framework: Framework.Vite, missed: [] }
};

const discovered = (name: string) => {
  const found = discoverRoutes({ files: TREES[name].files, texts: {} }, TREES[name].framework, '');
  return found.ok ? found.routes.map((r) => r.path) : [];
};

const RUN: ImportRun = { boot: { ok: true, installMs: null, readyMs: null }, discovered: null, routes: [], components: null, variants: null, instances: null, uses: null, tokens: null, bound: null, fidelity: null, phases: {}, sandboxMs: null };

describe('discovered routes against the corpus expected routes', () => {
  it.each(CORPUS.filter((e) => TREES[e.name]).map((e) => [e.name, e] as const))('%s', (name, entry) => {
    const found = discovered(name);
    expect(entry.expectedRoutes.filter((r) => !found.includes(r))).toEqual(TREES[name].missed);
  });

  it('next-playground: the corpus counts pages under _private folders, which Next does not route', () => {
    expect(TREES['next-playground'].missed.every((r) => nextPlayground.some((f) => f.startsWith('app/_') && f.includes(r.split('/')[1])))).toBe(true);
  });

  it('feeds route recall in the scorecard', () => {
    const entry = CORPUS.find((e) => e.name === 'traidue')!;
    expect(scoreRepo(entry, { ...RUN, discovered: discovered('traidue') }).metrics[Metric.RouteRecall]).toMatchObject({ value: 1 });
  });
});
