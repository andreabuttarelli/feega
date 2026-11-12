import { compOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { fontsFor, landPlan, pageTreeAt, publicUrl, UrlImportOutcome, withSheetFonts, type PageAsk, type Planner } from '$lib/server/url-import/import-url';
import { urlPlan } from '$lib/server/url-import/url-doc';
import type { OpenAppBrowser } from '$lib/server/web/browser';
import type { ComponentUse } from './component-marks';
import { codePlan } from './code-doc';
import { boardsOf, conditioned, cropped, type Capture } from './boards';
import { BASE_CONDITIONS, conditionKey, variantsOf, type RenderConditions } from './render-conditions';
import { CAPTURE_BUDGET_MS, delayFor, NO_DELAY, type CaptureDelay } from './capture-wait';
import { ownImages } from './page-images';
import { located, repoOf, routesOf, type RepoRef } from './repo';
import { appOf, PlanRefusal } from './run-plan';
import type { RepoRunner, RunningApp } from './sandbox-runner';
import { importKeyCookie } from './origin-proxy';
import { designed, designOf, DesignSystem, modeOfScheme, withBoard, type Design, type DesignReport } from './design-system';
import type { TokenMap } from './design-tokens';
import { computedSheet, type LoadedSheet } from './css-tokens';
import type { ReadFile } from './write-back';
import { declaredAxes, libraryReport, type Discovery, type LibraryReport } from './component-discovery';
import { Gate, lockedOut, lockedRoute, signedIn, type LockedRoute, type SignIn, type TestAccount } from './sign-in';

export enum CodeImportOutcome {
  Ok = 'ok',
  Invalid = 'invalid',
  NoSandbox = 'no_sandbox',
  RunFailed = 'run_failed',
  NoBrowser = 'no_browser',
  Failed = 'failed',
  Unreadable = 'unreadable',
  RateLimited = 'rate_limited',
  SignInNeeded = 'sign_in_needed',
  ChooseApp = 'choose_app'
}

export const CODE_IMPORT_STATUS: Record<Exclude<CodeImportOutcome, CodeImportOutcome.Ok>, number> = {
  [CodeImportOutcome.Invalid]: 400,
  [CodeImportOutcome.NoSandbox]: 503,
  [CodeImportOutcome.RunFailed]: 422,
  [CodeImportOutcome.NoBrowser]: 503,
  [CodeImportOutcome.Failed]: 502,
  [CodeImportOutcome.Unreadable]: 422,
  [CodeImportOutcome.RateLimited]: 429,
  [CodeImportOutcome.SignInNeeded]: 422,
  [CodeImportOutcome.ChooseApp]: 409
};

const FROM_URL_IMPORT: Record<Exclude<UrlImportOutcome, UrlImportOutcome.Ok>, Exclude<CodeImportOutcome, CodeImportOutcome.Ok>> = {
  [UrlImportOutcome.Invalid]: CodeImportOutcome.Invalid,
  [UrlImportOutcome.NotPublic]: CodeImportOutcome.Failed,
  [UrlImportOutcome.NoBrowser]: CodeImportOutcome.NoBrowser,
  [UrlImportOutcome.Failed]: CodeImportOutcome.Failed,
  [UrlImportOutcome.Unreadable]: CodeImportOutcome.Unreadable,
  [UrlImportOutcome.TooSlow]: CodeImportOutcome.Failed,
  [UrlImportOutcome.RateLimited]: CodeImportOutcome.RateLimited,
  [UrlImportOutcome.Busy]: CodeImportOutcome.RateLimited,
  [UrlImportOutcome.Rejected]: CodeImportOutcome.Unreadable
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

type Refusal = { outcome: Exclude<CodeImportOutcome, CodeImportOutcome.Ok>; error?: string; apps?: string[]; locked?: LockedRoute[] };

export type CodeOrigin = { repo: string; branch: string | null; sha: string | null; app: string | null };

export type CodeImported = ({ outcome: CodeImportOutcome.Ok; frameId: string; origin?: CodeOrigin; name: string; undo: unknown[]; skipped: string[]; locked: LockedRoute[]; truncated: boolean; pages: string[]; design?: DesignReport; tokenMap?: TokenMap; library?: LibraryReport } & ComponentCount) | Refusal;

export type CodePage = { label: string; url: string; route?: string; conditions?: RenderConditions };

export type LandAsk = Omit<PageAsk, 'url' | 'planner'>;

export type RepoArchive = (repo: RepoRef) => Promise<Uint8Array | null>;

export type CodeReader = (rev: string | null) => ReadFile;

export type DesignOptions = { code?: CodeReader | null; designSystem?: DesignSystem };

export type BranchList = (repo: RepoRef) => Promise<string[]>;

export type SignInAsk = { account?: TestAccount | null };

export type CodeAsk = LandAsk & DesignOptions & SignInAsk & { repo: string; app?: string; routes: string[]; conditions?: RenderConditions[]; delay?: CaptureDelay; runner: RepoRunner | null; archive?: RepoArchive | null; branches?: BranchList | null };

const refused = (outcome: Refusal['outcome'], error?: string, apps?: string[]): Refusal => ({ outcome, ...(error ? { error } : {}), ...(apps?.length ? { apps } : {}) });

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function marksPlanner(names: string[], found: { uses: ComponentUse[] }, delayMs = 0): Planner {
  return {
    prepare: async (tab) => {
      await pause(delayMs);
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

enum Missed {
  Unopened = 'could not be opened',
  OutOfTime = 'left out, the import ran out of time'
}

type Window = { settleMs: number; budgetMs: number; now: () => number; delay: CaptureDelay };

type Captured = { captures: Capture[]; missed: string[]; locked: LockedRoute[]; last: Refusal | null };

const loginOf = (sign: SignIn) => (sign.gate === Gate.None ? null : sign.loginUrl);

function inSession(open: OpenAppBrowser, sign: SignIn): OpenAppBrowser {
  if (sign.gate !== Gate.Signed) {
    return open;
  }
  return async () => {
    const tab = await open();
    await tab.restore(sign.session, new URL(sign.loginUrl).origin);
    return tab;
  };
}

async function captured(open: OpenAppBrowser, pages: CodePage[], names: string[], window: Window, sign: SignIn): Promise<Captured> {
  const captures: Capture[] = [];
  const missed: string[] = [];
  const locked: LockedRoute[] = [];
  const until = window.now() + window.budgetMs;
  let last: Refusal | null = null;
  for (const page of pages) {
    if (captures.length && window.now() > until) {
      missed.push(`${page.label}: ${Missed.OutOfTime}`);
      continue;
    }
    const found = { uses: [] as ComponentUse[] };
    const conditions = page.conditions ?? BASE_CONDITIONS;
    const tab = await open();
    await tab.scheme(conditions.scheme).catch(() => undefined);
    await tab.viewport(conditions.width).catch(() => undefined);
    const read = await pageTreeAt(tab, new URL(page.url), window.settleMs, marksPlanner(names, found, delayFor(window.delay, page.route ?? '', pages.length)))
      .then(async (tree) => ({ tree, out: await lockedOut(tab, page.url, loginOf(sign)) }))
      .finally(() => tab.close());
    if (read.out) {
      locked.push(lockedRoute(page.label, sign));
      continue;
    }
    if ('outcome' in read.tree) {
      missed.push(`${page.label}: ${Missed.Unopened}`);
      last = read.tree.outcome === UrlImportOutcome.Ok ? null : refused(FROM_URL_IMPORT[read.tree.outcome], read.tree.error);
      continue;
    }
    captures.push({ label: page.label, tree: conditioned(read.tree, conditionKey(conditions)), uses: found.uses });
  }
  return { captures, missed, locked, last };
}

export type Designer = (loaded: LoadedSheet[]) => Promise<Design | null>;

const lockedLine = (route: LockedRoute) => `${route.label}: ${route.reason}${route.detail ? ` (${route.detail})` : ''}`;

export type BoardsAsk = LandAsk & SignInAsk & { name: string; pages: CodePage[]; names: string[]; crop: Crop; budgetMs?: number; now?: () => number; design?: Designer | null; library?: Discovery; delay?: CaptureDelay };

export function designFor(ask: DesignOptions, rev: string | null): Designer | null {
  const code = ask.code;
  return code && ask.designSystem !== DesignSystem.Off ? (loaded) => designOf(code(rev), loaded).catch(() => null) : null;
}

function loadedOf(captures: Capture[], pages: CodePage[]): LoadedSheet[] {
  const modeOf = new Map(pages.map((p) => [p.label, modeOfScheme(p.conditions ?? BASE_CONDITIONS)]));
  const computed = captures.flatMap((c) => (c.tree.rootVars ? [computedSheet(c.tree.rootVars, modeOf.get(c.label) ?? modeOfScheme(BASE_CONDITIONS))] : []));
  return [...new Map([...captures.flatMap((c) => c.tree.styles ?? []), ...computed].map((s) => [s.at ?? s.text, s])).values()];
}

export async function importBoards(ask: BoardsAsk): Promise<CodeImported> {
  const first = ask.pages[0] ? await publicUrl(ask.pages[0].url, ask.guard) : null;
  if (!first) {
    return refused(CodeImportOutcome.Failed);
  }
  if (!ask.open) {
    return refused(CodeImportOutcome.NoBrowser);
  }

  const window = { settleMs: ask.settleMs ?? SETTLE_MS, budgetMs: ask.budgetMs ?? CAPTURE_BUDGET_MS, now: ask.now ?? Date.now, delay: ask.delay ?? NO_DELAY };
  const sign = await signedIn(ask.open, ask.account ?? null, first.href);
  const { captures, missed, locked, last } = await captured(inSession(ask.open, sign), ask.pages, ask.names, window, sign);
  if (!captures.length && locked.length) {
    return { ...refused(CodeImportOutcome.SignInNeeded, locked.map(lockedLine).join('\n')), locked };
  }
  if (!captures.length) {
    return last ?? refused(CodeImportOutcome.Unreadable);
  }

  const cropped = captures.map(CROPS[ask.crop]);
  const tokens = ask.design ? await ask.design(loadedOf(captures, ask.pages)) : null;
  const boards = boardsOf(ask.name, tokens ? withBoard(tokens, ask.name, cropped) : cropped);
  const [tree, uses] = [await withSheetFonts(ask, boards.tree), boards.uses];
  const planned = codePlan(tree, uses, ask.newId, await fontsFor(ask, tree), ask.library ? declaredAxes(ask.library) : undefined);
  const base = ask.pages[0]?.conditions ?? BASE_CONDITIONS;
  const boardModes = Object.fromEntries(ask.pages.map((p) => [p.label, modeOfScheme(p.conditions ?? BASE_CONDITIONS)]));
  const design = tokens && planned ? designed(tokens, planned, { repo: ask.name, base, boards: boardModes, captures: cropped, width: tree.root.absoluteBoundingBox?.width ?? tree.width }) : null;
  const done = await landPlan({ ...ask, importImage: ownImages(ask.importImage, ask.pages.map((p) => p.url)) }, design?.plan ?? planned, tree.truncated);
  if (done.outcome !== UrlImportOutcome.Ok) {
    return refused(FROM_URL_IMPORT[done.outcome], done.error);
  }

  const frame = await ask.store.read(done.frameId);
  const count = frame ? componentCount(frame.doc) : { components: 0, variants: 0, instances: 0 };
  const skipped = [...done.skipped, ...missed, ...locked.map(lockedLine), ...(design?.skipped ?? [])];
  const report = design ? { design: design.report, tokenMap: design.map } : {};
  const library = ask.library ? { library: libraryReport(ask.library, new Set(uses.map((u) => u.component))) } : {};
  return { ...done, outcome: CodeImportOutcome.Ok, skipped, locked, pages: captures.map((c) => c.label), ...count, ...report, ...library };
}

export type RunAsk = LandAsk & DesignOptions & SignInAsk & { repo: RepoRef; app: string | null; routes: string[]; conditions?: RenderConditions[]; delay?: CaptureDelay; runner: RepoRunner | null; archive: Uint8Array | null };

const AMBIGUOUS_REF = '/';

async function branchesFor(ask: CodeAsk, repo: RepoRef): Promise<string[]> {
  return repo.ref?.includes(AMBIGUOUS_REF) && ask.branches ? ask.branches(repo).catch(() => []) : [];
}

export async function importCodeAt(ask: CodeAsk): Promise<CodeImported> {
  const linked = repoOf(ask.repo);
  const routes = routesOf(ask.routes);
  const asked = ask.app === undefined ? undefined : appOf(ask.app);
  if (!linked || !routes || asked === null) {
    return refused(CodeImportOutcome.Invalid);
  }
  if (!ask.runner) {
    return refused(CodeImportOutcome.NoSandbox);
  }

  const { ref, path } = located(linked.ref, await branchesFor(ask, linked));
  const repo = { ...linked, ref };
  const archive = ask.archive ? await ask.archive(repo).catch(() => null) : null;
  return importRepoAt({ ...ask, repo, app: asked ?? path, routes, archive });
}

function keyed(open: OpenAppBrowser | null, app: RunningApp): OpenAppBrowser | null {
  if (!open) {
    return null;
  }
  return async () => {
    const tab = await open();
    await tab.restore({ cookies: [importKeyCookie(app)], storage: {} }, new URL(app.url).origin);
    return tab;
  };
}

export async function importRepoAt(ask: RunAsk): Promise<CodeImported> {
  const routes = routesOf(ask.routes);
  if (!routes) {
    return refused(CodeImportOutcome.Invalid);
  }
  if (!ask.runner) {
    return refused(CodeImportOutcome.NoSandbox);
  }

  const run = await ask.runner(ask.repo, ask.archive, ask.app);
  if (!run.ok) {
    return refused(run.failure === PlanRefusal.ChooseApp ? CodeImportOutcome.ChooseApp : CodeImportOutcome.RunFailed, `${run.failure}: ${run.detail}`, run.apps);
  }

  const pages = variantsOf(routes, ask.conditions ?? [BASE_CONDITIONS]).map((v) => ({ label: v.label, url: new URL(v.route, run.app.url).toString(), route: v.route, conditions: v.conditions }));
  const origin = { repo: `${ask.repo.owner}/${ask.repo.repo}`, branch: ask.repo.ref, sha: run.app.sha, app: ask.app };
  const design = designFor(ask, run.app.sha);
  const done = await importBoards({ ...ask, open: keyed(ask.open, run.app), name: ask.repo.repo, pages, names: run.app.names, crop: Crop.Page, design, library: run.app.library }).finally(() => run.app.stop().catch(() => undefined));
  return done.outcome === CodeImportOutcome.Ok ? { ...done, origin } : done;
}
