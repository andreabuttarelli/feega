import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { logAiCall } from '$lib/server/ai-log';
import { llmApiKey, llmBaseUrl, llmDefaultModel } from '$lib/server/llm';
import { safeFetchBytes } from '$lib/server/tool-guard';
import { chromiumPage, serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { ATTACHMENT_PORTS, inlineAttachment } from '$lib/server/chat-attachments/register';
import { CHAT_ATTACHMENT_MAX_BYTES } from '$lib/chat-attachments';
import type { ProjectMode } from '$lib/project-mode';
import { SearchEngine, exaSearch, openRouterSearch, searchEngineOf, type SearchPort } from './search';
import { readPage } from './read-page';
import { screenshotPage } from './screenshot';
import type { ImageImport, WebToolDeps } from './web-tools';

export type WebScope = { orgId: string; userId: string; projectId: string; brandId?: string | null };

const IMAGE_TIMEOUT_MS = 20_000;
const SEARCH_LABEL = 'web-search';

const ENGINES: Record<SearchEngine, () => { port: SearchPort; provider: 'exa' | 'llm'; model: string }> = {
  [SearchEngine.Exa]: () => ({ port: exaSearch(env.EXA_API_KEY!.trim()), provider: 'exa', model: 'exa-search' }),
  [SearchEngine.Gateway]: () => {
    const model = llmDefaultModel();
    return { port: openRouterSearch({ baseUrl: llmBaseUrl(), apiKey: llmApiKey() ?? '', model }), provider: 'llm', model: `${model}+web` };
  }
};

export function loggedSearch(scope: WebScope, engine: SearchEngine = searchEngineOf(env)): SearchPort {
  const { port, provider, model } = ENGINES[engine]();
  return async (query, max) => {
    const t0 = Date.now();
    const found = await port(query, max);
    logAiCall({
      label: SEARCH_LABEL,
      provider,
      model,
      prompt: query,
      ms: Date.now() - t0,
      ok: found.ok,
      ...(found.ok ? { flatCostUsd: found.costUsd } : { error: found.error }),
      orgId: scope.orgId,
      brandId: scope.brandId ?? undefined,
      userId: scope.userId,
      projectId: scope.projectId,
      actorKind: 'agent',
      actorId: scope.userId
    });
    return found;
  };
}

export function webImageImport(db: Db, scope: { orgId: string; projectId: string; mode: ProjectMode }): (url: string) => Promise<ImageImport> {
  return async (url) => {
    try {
      const fetched = await safeFetchBytes(url, { maxBytes: CHAT_ATTACHMENT_MAX_BYTES, timeoutMs: IMAGE_TIMEOUT_MS, scheme: 'https-only' });
      if (!fetched.ok || !fetched.mime.startsWith('image/')) {
        return { ok: false, error: fetched.ok ? `not a picture (${fetched.mime || 'unknown type'})` : `the server answered ${fetched.status}` };
      }
      const name = decodeURIComponent(new URL(fetched.url).pathname.split('/').pop() || 'image');
      const saved = await inlineAttachment(db, scope, { data: fetched.bytes.toString('base64'), name, mimeType: fetched.mime }, ATTACHMENT_PORTS);
      return { ok: true, assetId: saved.assetId, width: null, height: null };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
}

export function liveWebDeps(scope: WebScope, spend: (usd: number) => void): WebToolDeps {
  return {
    search: loggedSearch(scope),
    read: (url) => readPage(url),
    shoot: serverFramesOpen() ? (url, view) => screenshotPage(url, view, chromiumPage) : undefined,
    spend
  };
}
