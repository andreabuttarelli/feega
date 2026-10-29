import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { importCanvasLink } from '$lib/server/canvas/upload';
import { UPLOAD_MAX_BYTES } from '$lib/canvas/upload-kind';
import { frameStore } from '$lib/server/motion/move-element';
import { farmAccess } from '$lib/server/motion/vercel-farm';
import type { Actor } from '$lib/server/repos/actor';
import { assertPublicUrl } from '$lib/server/tool-guard';
import { rateWindow } from '$lib/server/figma/rate-window';
import { liveBrowser } from '$lib/server/web/live';
import { CodeImportOutcome, importCodeAt, type CodeImported } from './import-code';
import { logAiCall } from '$lib/server/ai-log';
import { sandboxRunner, sandboxUsd, type RepoRunner } from './sandbox-runner';

const IMPORT_WINDOW_MS = 10 * 60_000;
const IMPORTS_PER_WINDOW = 2;

const SANDBOX_LABEL = 'code-import-sandbox';

const limiter = rateWindow({ limit: IMPORTS_PER_WINDOW, windowMs: IMPORT_WINDOW_MS });

export type CodeScope = { db: Db; orgId: string; userId: string; projectId: string; actor: Actor };

export type CodeImportAsk = { repo: string; route?: string; at: { x: number; y: number } };

function metered(runner: RepoRunner, scope: CodeScope): RepoRunner {
  return async (repo) => {
    const started = Date.now();
    const bill = () => {
      const ms = Date.now() - started;
      logAiCall({ label: SANDBOX_LABEL, provider: 'vercel-sandbox', ms, ok: true, flatCostUsd: sandboxUsd(ms), orgId: scope.orgId, userId: scope.userId, projectId: scope.projectId, actorKind: 'agent', actorId: scope.userId });
    };
    const run = await runner(repo);
    if (!run.ok) {
      bill();
      return run;
    }
    return { ...run, app: { ...run.app, stop: () => run.app.stop().finally(bill) } };
  };
}

export async function importCodeInto(scope: CodeScope, canvasId: string, ask: CodeImportAsk): Promise<CodeImported> {
  if (!limiter.allow(scope.userId)) {
    return { outcome: CodeImportOutcome.RateLimited };
  }

  const access = farmAccess(env);
  const importImage = async (url: string) => (await importCanvasLink(scope.db, { orgId: scope.orgId, projectId: scope.projectId, url, maxBytes: UPLOAD_MAX_BYTES.image })).asset.id;

  return importCodeAt({
    ...ask,
    runner: access ? metered(sandboxRunner(access), scope) : null,
    store: frameStore(scope.db, { orgId: scope.orgId, actor: scope.actor, projectId: scope.projectId }),
    place: { projectId: scope.projectId, canvasId },
    open: liveBrowser({ orgId: scope.orgId, userId: scope.userId, projectId: scope.projectId }),
    guard: (url) => assertPublicUrl(url),
    importImage,
    newId: () => crypto.randomUUID().slice(0, 8)
  });
}
