import { componentsPage } from '$lib/server/canvas/components-page';
import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { frameStore } from '$lib/server/motion/move-element';
import { farmAccess } from '$lib/server/motion/vercel-farm';
import type { Actor } from '$lib/server/repos/actor';
import { assertPublicUrl } from '$lib/server/tool-guard';
import { rateWindow } from '$lib/server/figma/rate-window';
import { liveBrowser } from '$lib/server/web/live';
import { pageAssets } from '$lib/server/url-import/canvas-import';
import { CodeImportOutcome, Crop, designFor, importBoards, importCodeAt, importRepoAt, type BranchList, type CodeImported, type CodeReader, type LandAsk } from './import-code';
import { DesignSystem, tokenCount } from './design-system';
import { rawReader } from './repo-sync';
import { basename } from 'node:path';
import { localModeRefusal } from '$lib/server/local/local-mode';
import { localBrowser } from '$lib/server/web/browser';
import { chromiumPage } from '$lib/server/motion/chromium-frames';
import { DevServerFailed, withDevServer, folderFiles, folderHead, folderLibrary, folderNames, folderOf, folderSource } from './folder-source';
import { located, repoOf, routesOf, type RepoRef } from './repo';
import { SourceKind } from './code-source';
import { BASE_CONDITIONS, variantsOf, type RenderConditions, type Variant } from './render-conditions';
import type { CaptureDelay } from './capture-wait';
import { importStorybookAt } from './import-storybook';
import { logAiCall } from '$lib/server/ai-log';
import { sandboxRunner, sandboxUsd, type RepoRunner } from './sandbox-runner';
import { githubFor } from './github-runtime';
import { branchesOf, publicCall, treeOf } from './github';
import { appOf, PlanRefusal, type PlanRefused } from './run-plan';
import { snapshotSha, uploadedArchive, uploadFiles, uploadOf, uploadSource } from './upload-source';
import { allRoutes, leftOut, routesAt, tooManyRoutes, UNREADABLE, type LeftOut, type RouteSource, type RoutesFound } from './routes-found';
import { DataCheck, patchNodeData } from '$lib/server/repos/canvas';
import type { CodeOriginData } from '$lib/canvas/motion-node';
import { appAccountStore } from '$lib/server/repos/app-accounts';
import type { TestAccount } from './sign-in';
import { mapOf } from './import-map-of';

const IMPORT_WINDOW_MS = 10 * 60_000;
const IMPORTS_PER_WINDOW = 2;

const SANDBOX_LABEL = 'code-import-sandbox';

async function testAccountOf(scope: CodeScope): Promise<TestAccount | null> {
  const account = await appAccountStore(scope.db, scope).read().catch(() => null);
  return account ? { loginUrl: account.loginUrl, email: account.email, password: account.password } : null;
}

const limiter = rateWindow({ limit: IMPORTS_PER_WINDOW, windowMs: IMPORT_WINDOW_MS });

export type CodeScope = { db: Db; orgId: string; userId: string; projectId: string; actor: Actor };

export type CodeImportAsk = { repo?: string; folder?: string; upload?: string; app?: string; routes: string[]; conditions?: RenderConditions[]; variants?: Variant[]; delay?: CaptureDelay; designSystem?: DesignSystem; storybook?: string; stories?: string[]; at: { x: number; y: number } };

async function githubReader(scope: CodeScope, repo: string): Promise<CodeReader | null> {
  const ref = repoOf(repo);
  const call = ref ? await githubFor(scope.db, scope).call().catch(() => null) : null;
  return ref ? (rev) => rawReader(ref, rev ?? ref.ref ?? 'HEAD', call) : null;
}

const delayOf = (ask: CodeImportAsk) => (ask.delay ? { delay: ask.delay } : {});

const tokensOf = (done: CodeImported) => (done.outcome === CodeImportOutcome.Ok && done.tokenMap ? { tokens: done.tokenMap } : {});

function metered(runner: RepoRunner, scope: CodeScope): RepoRunner {
  return async (repo, archive, app) => {
    const started = Date.now();
    const bill = () => {
      const ms = Date.now() - started;
      logAiCall({ label: SANDBOX_LABEL, provider: 'vercel-sandbox', ms, ok: true, flatCostUsd: sandboxUsd(ms), orgId: scope.orgId, userId: scope.userId, projectId: scope.projectId, actorKind: 'agent', actorId: scope.userId });
    };
    const run = await runner(repo, archive, app);
    if (!run.ok) {
      bill();
      return run;
    }
    return { ...run, app: { ...run.app, stop: () => run.app.stop().finally(bill) } };
  };
}

function landing(scope: CodeScope, canvasId: string, at: { x: number; y: number }): LandAsk {
  return {
    at,
    store: frameStore(scope.db, { orgId: scope.orgId, actor: scope.actor, projectId: scope.projectId }),
    place: { projectId: scope.projectId, canvasId },
    open: liveBrowser({ orgId: scope.orgId, userId: scope.userId, projectId: scope.projectId }),
    guard: (url) => assertPublicUrl(url),
    ...pageAssets(scope),
    components: () => componentsPage(scope.db, scope),
    newId: () => crypto.randomUUID().slice(0, 8)
  };
}

export type CodeLanded = CodeImported & { code?: CodeOriginData };

export async function importCodeInto(scope: CodeScope, canvasId: string, ask: CodeImportAsk): Promise<CodeLanded> {
  const land = landing(scope, canvasId, ask.at);
  if (ask.folder !== undefined) {
    return importFolderInto(scope, land, ask);
  }
  if (ask.upload !== undefined) {
    return importUploadInto(scope, land, ask);
  }

  if (!limiter.allow(scope.userId)) {
    return { outcome: CodeImportOutcome.RateLimited };
  }

  if (ask.storybook) {
    return importStorybookAt({ ...land, storybook: ask.storybook, stories: ask.stories });
  }

  const code = await githubReader(scope, ask.repo ?? '');
  const github = githubFor(scope.db, scope);
  const branches: BranchList = async (repo) => (await github.branches(repo)) ?? branchesOf(publicCall(), repo);
  const done = await importCodeAt({ ...land, repo: ask.repo ?? '', app: ask.app, routes: ask.routes, conditions: ask.conditions, variants: ask.variants, delay: ask.delay, runner: sandboxOf(scope), archive: github.archive, branches, code, designSystem: ask.designSystem, account: await testAccountOf(scope) });
  if (done.outcome !== CodeImportOutcome.Ok || !done.origin) {
    return done;
  }
  const { app, ...origin } = done.origin;
  return { ...done, code: { kind: SourceKind.Github, ...origin, ...(app ? { app } : {}), routes: ask.routes.length ? ask.routes : ['/'], ...(ask.conditions ? { conditions: ask.conditions } : {}), ...delayOf(ask), ...tokensOf(done) } };
}

const UPLOAD_OWNER = 'upload';

const appAsked = (ask: CodeImportAsk): string | null | undefined => (ask.app === undefined ? null : (appOf(ask.app) ?? undefined));

const unplanned = (plan: PlanRefused): CodeImported => ({ outcome: plan.refusal === PlanRefusal.ChooseApp ? CodeImportOutcome.ChooseApp : CodeImportOutcome.RunFailed, error: `${plan.refusal}: ${plan.reason}`, ...(plan.apps.length ? { apps: plan.apps } : {}) });

function sandboxOf(scope: CodeScope): RepoRunner | null {
  const access = farmAccess(env);
  return access ? metered(sandboxRunner(access), scope) : null;
}

async function importUploadInto(scope: CodeScope, land: LandAsk, ask: CodeImportAsk): Promise<CodeLanded> {
  const upload = uploadOf(scope.orgId, ask.upload ?? '');
  const routes = routesOf(ask.routes);
  const app = appAsked(ask);
  if (!upload || !routes || app === undefined) {
    return { outcome: CodeImportOutcome.Invalid };
  }
  if (!limiter.allow(scope.userId)) {
    return { outcome: CodeImportOutcome.RateLimited };
  }
  const archive = await uploadedArchive(scope.db, upload);
  if (!archive) {
    return { outcome: CodeImportOutcome.Invalid };
  }

  const code = () => uploadSource(archive).read('');
  const done = await importRepoAt({ ...land, repo: { owner: UPLOAD_OWNER, repo: upload.name, ref: null }, app, routes, conditions: ask.conditions, variants: ask.variants, delay: ask.delay, runner: sandboxOf(scope), archive, code, designSystem: ask.designSystem, account: await testAccountOf(scope) });
  return done.outcome === CodeImportOutcome.Ok ? { ...done, code: { kind: SourceKind.Upload, repo: upload.path, branch: null, sha: snapshotSha(archive), ...(app ? { app } : {}), routes, ...(ask.conditions ? { conditions: ask.conditions } : {}), ...delayOf(ask), ...tokensOf(done) } } : done;
}

async function importFolderInto(scope: CodeScope, land: LandAsk, ask: CodeImportAsk): Promise<CodeLanded> {
  const root = localModeRefusal(env) === null ? folderOf(ask.folder ?? '') : null;
  const routes = routesOf(ask.routes);
  const app = appAsked(ask);
  if (!root || !routes || app === undefined) {
    return { outcome: CodeImportOutcome.Invalid };
  }
  const done = await withDevServer(root, app, (url) => importServed(land, ask, { root, routes, url })).catch(unstarted);
  if (done instanceof DevServerFailed) {
    return { outcome: CodeImportOutcome.RunFailed, error: done.message };
  }
  if ('refusal' in done) {
    return unplanned(done);
  }
  return done.outcome === CodeImportOutcome.Ok ? { ...done, code: { kind: SourceKind.Folder, repo: root, branch: null, sha: await folderHead(root), ...(app ? { app } : {}), routes, ...(ask.conditions ? { conditions: ask.conditions } : {}), ...delayOf(ask), ...tokensOf(done) } } : done;
}

function unstarted(e: unknown): DevServerFailed {
  if (e instanceof DevServerFailed) {
    return e;
  }
  throw e;
}

async function importServed(land: LandAsk, ask: CodeImportAsk, { root, routes, url }: { root: string; routes: string[]; url: string }): Promise<CodeImported> {
  const origin = new URL(url).origin;
  const only = async (at: URL) => {
    if (at.origin !== origin) {
      throw new Error('outside the folder dev server');
    }
  };
  const pages = (ask.variants ?? variantsOf(routes, ask.conditions ?? [BASE_CONDITIONS])).map((v) => ({ label: v.label, url: new URL(v.route, url).toString(), route: v.route, conditions: v.conditions }));
  const design = await designFor({ code: () => folderSource(root).read(''), designSystem: ask.designSystem }, null);
  return importBoards({ ...land, open: localBrowser(chromiumPage, origin), guard: only, name: basename(root), pages, names: await folderNames(root), crop: Crop.Page, design, library: await folderLibrary(root).catch(() => undefined), delay: ask.delay });
}

export async function rememberOrigin(scope: CodeScope, nodeId: string, origin: CodeOriginData): Promise<void> {
  await patchNodeData(scope.db, { orgId: scope.orgId, nodeId, patch: { code: origin }, check: DataCheck.None, actor: scope.actor });
}

export async function tokensFound(scope: CodeScope, where: { repo?: string; folder?: string; upload?: string }): Promise<number | null> {
  if (where.upload !== undefined) {
    const upload = uploadOf(scope.orgId, where.upload);
    const archive = upload ? await uploadedArchive(scope.db, upload) : null;
    return archive ? tokenCount(uploadSource(archive).read('')) : null;
  }
  if (where.folder !== undefined) {
    const root = localModeRefusal(env) === null ? folderOf(where.folder) : null;
    return root ? tokenCount(folderSource(root).read('')) : null;
  }
  const code = await githubReader(scope, where.repo ?? '');
  return code ? tokenCount(code(null)).catch(() => null) : null;
}

export type RoutesWhere = { repo?: string; folder?: string; upload?: string; app?: string };

const NO_SOURCE: RouteSource = { files: async () => null, read: async () => null };

async function githubRoutes(scope: CodeScope, raw: string): Promise<{ source: RouteSource; path: string | null }> {
  const linked = repoOf(raw);
  if (!linked) {
    return { source: NO_SOURCE, path: null };
  }
  const github = githubFor(scope.db, scope);
  const call = await github.call().catch(() => null);
  const branches = linked.ref?.includes('/') ? ((await github.branches(linked).catch(() => null)) ?? (await branchesOf(publicCall(), linked).catch(() => []))) : [];
  const { ref, path } = located(linked.ref, branches);
  const repo: RepoRef = { ...linked, ref };
  return { source: { files: () => treeOf(call ?? publicCall(), repo), read: rawReader(repo, ref ?? 'HEAD', call) }, path };
}

async function routeSourceOf(scope: CodeScope, where: RoutesWhere): Promise<{ source: RouteSource; path: string | null }> {
  if (where.upload !== undefined) {
    const upload = uploadOf(scope.orgId, where.upload);
    const archive = upload ? await uploadedArchive(scope.db, upload) : null;
    return { source: archive ? { files: async () => uploadFiles(archive), read: uploadSource(archive).read('') } : NO_SOURCE, path: null };
  }
  if (where.folder !== undefined) {
    const root = localModeRefusal(env) === null ? folderOf(where.folder) : null;
    return { source: root ? { files: () => folderFiles(root), read: folderSource(root).read('') } : NO_SOURCE, path: null };
  }
  return githubRoutes(scope, where.repo ?? '');
}

export async function routesFound(scope: CodeScope, where: RoutesWhere): Promise<RoutesFound> {
  const app = where.app === undefined ? undefined : appOf(where.app);
  if (app === null) {
    return { ok: false, error: UNREADABLE, detail: 'that app folder is not a path inside the repository', apps: [] };
  }
  const { source, path } = await routeSourceOf(scope, where);
  return routesAt(source, app ?? path);
}

export const ALL_ROUTES = 'all';

export type RoutesAsk = Omit<CodeImportAsk, 'routes'> & { routes: string[] | typeof ALL_ROUTES };

export type RouteReport = { discovered: number; leftOut: LeftOut[] } | { unrun: string };

export type RoutedImport = CodeLanded & { routes?: RouteReport };

const refusedRoutes = (error: string): RoutedImport => ({ outcome: CodeImportOutcome.Invalid, error });

function reportOf(found: RoutesFound, asked: string[], done: CodeImported): RouteReport {
  if (!found.ok) {
    return { unrun: `${found.error}: ${found.detail}` };
  }
  if (done.outcome !== CodeImportOutcome.Ok) {
    return { unrun: 'the import did not land' };
  }
  return { discovered: found.routes.length, leftOut: leftOut(found.routes, { asked: asked.length ? asked : ['/'], landed: done.pages, links: done.links ?? [] }) };
}

export async function importRoutesInto(scope: CodeScope, canvasId: string, ask: RoutesAsk): Promise<RoutedImport> {
  if (ask.storybook) {
    return importCodeInto(scope, canvasId, { ...ask, routes: [] });
  }

  const discovering = routesFound(scope, ask).catch((e: unknown): RoutesFound => ({ ok: false, error: UNREADABLE, detail: String(e), apps: [] }));
  const found = ask.routes === ALL_ROUTES ? await discovering : null;
  if (found && !found.ok) {
    return { outcome: found.error === PlanRefusal.ChooseApp ? CodeImportOutcome.ChooseApp : CodeImportOutcome.Invalid, error: `${found.error}: ${found.detail}`, ...(found.apps.length ? { apps: found.apps } : {}) };
  }

  const routes = found?.ok ? allRoutes(found.routes) : (ask.routes as string[]);
  const many = tooManyRoutes(routes);
  if (many) {
    return refusedRoutes(many);
  }

  const done = await importCodeInto(scope, canvasId, { ...ask, routes });
  if (done.outcome !== CodeImportOutcome.Ok) {
    return done;
  }
  const listed = await discovering;
  if (done.code) {
    await rememberOrigin(scope, done.frameId, { ...done.code, map: mapOf(listed, done, { asked: routes.length ? routes : ['/'], rev: done.code.sha }) });
  }
  return { ...done, routes: reportOf(listed, routes, done) };
}
