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
import { CodeImportOutcome, Crop, importBoards, importCodeAt, type CodeImported, type LandAsk } from './import-code';
import { basename } from 'node:path';
import { localModeRefusal } from '$lib/server/local/local-mode';
import { localBrowser } from '$lib/server/web/browser';
import { chromiumPage } from '$lib/server/motion/chromium-frames';
import { devServerOf, folderHead, folderNames, folderOf } from './folder-source';
import { routesOf } from './repo';
import { SourceKind } from './code-source';
import { BASE_CONDITIONS, variantsOf, type RenderConditions } from './render-conditions';
import { importStorybookAt } from './import-storybook';
import { logAiCall } from '$lib/server/ai-log';
import { sandboxRunner, sandboxUsd, type RepoRunner } from './sandbox-runner';
import { githubFor } from './github-runtime';
import { DataCheck, patchNodeData } from '$lib/server/repos/canvas';
import type { CodeOriginData } from '$lib/canvas/motion-node';

const IMPORT_WINDOW_MS = 10 * 60_000;
const IMPORTS_PER_WINDOW = 2;

const SANDBOX_LABEL = 'code-import-sandbox';

const limiter = rateWindow({ limit: IMPORTS_PER_WINDOW, windowMs: IMPORT_WINDOW_MS });

export type CodeScope = { db: Db; orgId: string; userId: string; projectId: string; actor: Actor };

export type CodeImportAsk = { repo?: string; folder?: string; routes: string[]; conditions?: RenderConditions[]; storybook?: string; stories?: string[]; at: { x: number; y: number } };

function metered(runner: RepoRunner, scope: CodeScope): RepoRunner {
  return async (repo, archive) => {
    const started = Date.now();
    const bill = () => {
      const ms = Date.now() - started;
      logAiCall({ label: SANDBOX_LABEL, provider: 'vercel-sandbox', ms, ok: true, flatCostUsd: sandboxUsd(ms), orgId: scope.orgId, userId: scope.userId, projectId: scope.projectId, actorKind: 'agent', actorId: scope.userId });
    };
    const run = await runner(repo, archive);
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

export async function importCodeInto(scope: CodeScope, canvasId: string, ask: CodeImportAsk): Promise<CodeImported> {
  const land = landing(scope, canvasId, ask.at);
  if (ask.folder !== undefined) {
    return importFolderInto(scope, land, ask);
  }

  if (!limiter.allow(scope.userId)) {
    return { outcome: CodeImportOutcome.RateLimited };
  }

  if (ask.storybook) {
    return importStorybookAt({ ...land, storybook: ask.storybook, stories: ask.stories });
  }

  const access = farmAccess(env);
  const done = await importCodeAt({ ...land, repo: ask.repo ?? '', routes: ask.routes, conditions: ask.conditions, runner: access ? metered(sandboxRunner(access), scope) : null, archive: githubFor(scope.db, scope).archive });
  if (done.outcome === CodeImportOutcome.Ok && done.origin) {
    await rememberOrigin(scope, done.frameId, { kind: SourceKind.Github, ...done.origin, routes: ask.routes.length ? ask.routes : ['/'], ...(ask.conditions ? { conditions: ask.conditions } : {}) });
  }
  return done;
}

async function importFolderInto(scope: CodeScope, land: LandAsk, ask: CodeImportAsk): Promise<CodeImported> {
  const root = localModeRefusal(env) === null ? folderOf(ask.folder ?? '') : null;
  const routes = routesOf(ask.routes);
  if (!root || !routes) {
    return { outcome: CodeImportOutcome.Invalid };
  }
  const served = await devServerOf(root).catch((e: unknown) => e as Error);
  if (served instanceof Error) {
    return { outcome: CodeImportOutcome.RunFailed, error: served.message };
  }
  const origin = new URL(served.url).origin;
  const only = async (url: URL) => {
    if (url.origin !== origin) {
      throw new Error('outside the folder dev server');
    }
  };
  const pages = variantsOf(routes, ask.conditions ?? [BASE_CONDITIONS]).map((v) => ({ label: v.label, url: new URL(v.route, served.url).toString(), conditions: v.conditions }));
  const done = await importBoards({ ...land, open: localBrowser(chromiumPage, origin), guard: only, name: basename(root), pages, names: await folderNames(root), crop: Crop.Page });
  if (done.outcome === CodeImportOutcome.Ok) {
    await rememberOrigin(scope, done.frameId, { kind: SourceKind.Folder, repo: root, branch: null, sha: await folderHead(root), routes, ...(ask.conditions ? { conditions: ask.conditions } : {}) });
  }
  return done;
}

export async function rememberOrigin(scope: CodeScope, nodeId: string, origin: CodeOriginData): Promise<void> {
  await patchNodeData(scope.db, { orgId: scope.orgId, nodeId, patch: { code: origin }, check: DataCheck.None, actor: scope.actor });
}
