import { compOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { importPageAt, UrlImportOutcome, type PageAsk, type Planner } from '$lib/server/url-import/import-url';
import type { ComponentUse } from './component-marks';
import { codePlan } from './code-doc';
import { repoOf, routeOf } from './repo';
import type { RepoRunner } from './sandbox-runner';

export enum CodeImportOutcome {
  Ok = 'ok',
  Invalid = 'invalid',
  NoSandbox = 'no_sandbox',
  RunFailed = 'run_failed',
  NoBrowser = 'no_browser',
  Failed = 'failed',
  Unreadable = 'unreadable',
  RateLimited = 'rate_limited'
}

export const CODE_IMPORT_STATUS: Record<Exclude<CodeImportOutcome, CodeImportOutcome.Ok>, number> = {
  [CodeImportOutcome.Invalid]: 400,
  [CodeImportOutcome.NoSandbox]: 503,
  [CodeImportOutcome.RunFailed]: 422,
  [CodeImportOutcome.NoBrowser]: 503,
  [CodeImportOutcome.Failed]: 502,
  [CodeImportOutcome.Unreadable]: 422,
  [CodeImportOutcome.RateLimited]: 429
};

const FROM_URL_IMPORT: Record<Exclude<UrlImportOutcome, UrlImportOutcome.Ok>, Exclude<CodeImportOutcome, CodeImportOutcome.Ok>> = {
  [UrlImportOutcome.Invalid]: CodeImportOutcome.Invalid,
  [UrlImportOutcome.NotPublic]: CodeImportOutcome.Failed,
  [UrlImportOutcome.NoBrowser]: CodeImportOutcome.NoBrowser,
  [UrlImportOutcome.Failed]: CodeImportOutcome.Failed,
  [UrlImportOutcome.Unreadable]: CodeImportOutcome.Unreadable,
  [UrlImportOutcome.RateLimited]: CodeImportOutcome.RateLimited
};

export type ComponentCount = { components: number; variants: number; instances: number };

export type CodeImported = ({ outcome: CodeImportOutcome.Ok; frameId: string; name: string; undo: unknown[]; skipped: string[]; truncated: boolean } & ComponentCount) | { outcome: Exclude<CodeImportOutcome, CodeImportOutcome.Ok>; error?: string };

export type CodeAsk = Omit<PageAsk, 'url' | 'planner'> & { repo: string; route?: string; runner: RepoRunner | null };

function codePlanner(names: string[]): Planner {
  let uses: ComponentUse[] = [];
  return {
    prepare: async (tab) => {
      uses = await tab.marks(names);
    },
    plan: (tree, newId) => codePlan(tree, uses, newId)
  };
}

export function componentCount(doc: MotionDoc): ComponentCount {
  const mains = Object.entries(doc.comps).filter(([, c]) => c.component);
  const ids = new Set(mains.map(([id]) => id));
  const clips = [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);
  const hosts = clips.filter((c) => ids.has(compOf(c) ?? '')).length;
  return { components: new Set(mains.map(([, c]) => c.component!.set ?? c.component!.name)).size, variants: mains.length, instances: hosts - mains.length };
}

export async function importCodeAt(ask: CodeAsk): Promise<CodeImported> {
  const repo = repoOf(ask.repo);
  const route = routeOf(ask.route);
  if (!repo || !route) {
    return { outcome: CodeImportOutcome.Invalid };
  }
  if (!ask.runner) {
    return { outcome: CodeImportOutcome.NoSandbox };
  }

  const run = await ask.runner(repo);
  if (!run.ok) {
    return { outcome: CodeImportOutcome.RunFailed, error: `${run.failure}: ${run.detail}` };
  }

  const done = await importPageAt({ ...ask, url: new URL(route, run.app.url).toString(), planner: codePlanner(run.app.names) }).finally(() => run.app.stop().catch(() => undefined));
  if (done.outcome !== UrlImportOutcome.Ok) {
    return { outcome: FROM_URL_IMPORT[done.outcome], ...(done.error ? { error: done.error } : {}) };
  }

  const frame = await ask.store.read(done.frameId);
  const count = frame ? componentCount(frame.doc) : { components: 0, variants: 0, instances: 0 };
  return { ...done, outcome: CodeImportOutcome.Ok, ...count };
}
