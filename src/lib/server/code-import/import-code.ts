import { compOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { fontsFor, landPlan, pageTreeAt, publicUrl, UrlImportOutcome, type PageAsk, type Planner } from '$lib/server/url-import/import-url';
import { urlPlan } from '$lib/server/url-import/url-doc';
import type { AppTab } from '$lib/server/web/browser';
import type { ComponentUse } from './component-marks';
import { codePlan } from './code-doc';
import { boardsOf, cropped, type Capture } from './boards';
import { repoOf, routesOf, type RepoRef } from './repo';
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

export enum Crop {
  Page = 'page',
  Content = 'content'
}

const CONTENT_MARGIN = 24;
const SETTLE_MS = 1_200;

const CROPS: Record<Crop, (capture: Capture) => Capture> = {
  [Crop.Page]: (capture) => capture,
  [Crop.Content]: (capture) => ({ ...capture, tree: cropped(capture.tree, CONTENT_MARGIN) })
};

export type ComponentCount = { components: number; variants: number; instances: number };

type Refusal = { outcome: Exclude<CodeImportOutcome, CodeImportOutcome.Ok>; error?: string };

export type CodeImported = ({ outcome: CodeImportOutcome.Ok; frameId: string; name: string; undo: unknown[]; skipped: string[]; truncated: boolean; pages: string[] } & ComponentCount) | Refusal;

export type CodePage = { label: string; url: string };

export type LandAsk = Omit<PageAsk, 'url' | 'planner'>;

export type RepoArchive = (repo: RepoRef) => Promise<Uint8Array | null>;

export type CodeAsk = LandAsk & { repo: string; routes: string[]; runner: RepoRunner | null; archive?: RepoArchive | null };

const refused = (outcome: Refusal['outcome'], error?: string): Refusal => ({ outcome, ...(error ? { error } : {}) });

export function marksPlanner(names: string[], found: { uses: ComponentUse[] }): Planner {
  return {
    prepare: async (tab) => {
      found.uses = await tab.marks(names);
    },
    plan: (tree, newId, fonts) => urlPlan(tree, newId, undefined, fonts)
  };
}

export function componentCount(doc: MotionDoc): ComponentCount {
  const mains = Object.entries(doc.comps).filter(([, c]) => c.component);
  const ids = new Set(mains.map(([id]) => id));
  const clips = [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);
  const hosts = clips.filter((c) => ids.has(compOf(c) ?? '')).length;
  return { components: new Set(mains.map(([, c]) => c.component!.set ?? c.component!.name)).size, variants: mains.length, instances: hosts - mains.length };
}

async function captured(tab: AppTab, pages: CodePage[], names: string[], settleMs: number): Promise<{ captures: Capture[]; missed: string[]; last: Refusal | null }> {
  const captures: Capture[] = [];
  const missed: string[] = [];
  let last: Refusal | null = null;
  for (const page of pages) {
    const found = { uses: [] as ComponentUse[] };
    const tree = await pageTreeAt(tab, new URL(page.url), settleMs, marksPlanner(names, found));
    if ('outcome' in tree) {
      missed.push(page.label);
      last = tree.outcome === UrlImportOutcome.Ok ? null : refused(FROM_URL_IMPORT[tree.outcome], tree.error);
      continue;
    }
    captures.push({ label: page.label, tree, uses: found.uses });
  }
  return { captures, missed, last };
}

export type BoardsAsk = LandAsk & { name: string; pages: CodePage[]; names: string[]; crop: Crop };

export async function importBoards(ask: BoardsAsk): Promise<CodeImported> {
  const first = ask.pages[0] ? await publicUrl(ask.pages[0].url, ask.guard) : null;
  if (!first) {
    return refused(CodeImportOutcome.Failed);
  }
  if (!ask.open) {
    return refused(CodeImportOutcome.NoBrowser);
  }

  const tab = await ask.open();
  const { captures, missed, last } = await captured(tab, ask.pages, ask.names, ask.settleMs ?? SETTLE_MS).finally(() => tab.close());
  if (!captures.length) {
    return last ?? refused(CodeImportOutcome.Unreadable);
  }

  const { tree, uses } = boardsOf(ask.name, captures.map(CROPS[ask.crop]));
  const done = await landPlan(ask, codePlan(tree, uses, ask.newId, await fontsFor(ask, tree)), tree.truncated);
  if (done.outcome !== UrlImportOutcome.Ok) {
    return refused(FROM_URL_IMPORT[done.outcome], done.error);
  }

  const frame = await ask.store.read(done.frameId);
  const count = frame ? componentCount(frame.doc) : { components: 0, variants: 0, instances: 0 };
  const skipped = [...done.skipped, ...missed.map((label) => `${label}: could not be opened`)];
  return { ...done, outcome: CodeImportOutcome.Ok, skipped, pages: captures.map((c) => c.label), ...count };
}

export async function importCodeAt(ask: CodeAsk): Promise<CodeImported> {
  const repo = repoOf(ask.repo);
  const routes = routesOf(ask.routes);
  if (!repo || !routes) {
    return refused(CodeImportOutcome.Invalid);
  }
  if (!ask.runner) {
    return refused(CodeImportOutcome.NoSandbox);
  }

  const archive = ask.archive ? await ask.archive(repo).catch(() => null) : null;
  const run = await ask.runner(repo, archive);
  if (!run.ok) {
    return refused(CodeImportOutcome.RunFailed, `${run.failure}: ${run.detail}`);
  }

  const pages = routes.map((route) => ({ label: route, url: new URL(route, run.app.url).toString() }));
  return importBoards({ ...ask, name: repo.repo, pages, names: run.app.names, crop: Crop.Page }).finally(() => run.app.stop().catch(() => undefined));
}
