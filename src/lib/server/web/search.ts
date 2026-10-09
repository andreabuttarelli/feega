export type WebResult = { title: string; url: string; snippet: string; date: string | null };

export type WebSearch = { ok: true; results: WebResult[]; costUsd: number } | { ok: false; error: string };

export type SearchPort = (query: string, max: number) => Promise<WebSearch>;

export enum SearchEngine {
  Exa = 'exa',
  Gateway = 'gateway'
}

const EXA_URL = 'https://api.exa.ai/search';
const EXA_CONTENTS_URL = 'https://api.exa.ai/contents';
const CONTENTS_MAX_CHARS = 20_000;
const SEARCH_TIMEOUT_MS = 20_000;
const SNIPPET_MAX = 400;
const HIGHLIGHT_SENTENCES = 3;
const HIGHLIGHT_JOIN = ' … ';
const DATE_LENGTH = 10;

const snippetOf = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX);

const failed = (error: unknown): WebSearch => ({ ok: false, error: `web search failed: ${error instanceof Error ? error.message : String(error)}` });

async function posted(http: typeof fetch, url: string, headers: Record<string, string>, body: unknown): Promise<Record<string, unknown>> {
  const res = await http(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: unknown };
  if (!res.ok || json.error) {
    const error = json.error;
    throw new Error(typeof error === 'string' ? error : ((error as { message?: string })?.message ?? `HTTP ${res.status}`));
  }
  return json;
}

type ExaResult = { title?: string | null; url: string; publishedDate?: string | null; highlights?: string[]; text?: string };

export function exaSearch(apiKey: string, http: typeof fetch = fetch): SearchPort {
  return async (query, max) => {
    try {
      const body = (await posted(http, EXA_URL, { 'x-api-key': apiKey }, { query, numResults: max, contents: { highlights: { numSentences: HIGHLIGHT_SENTENCES } } })) as { results?: ExaResult[]; costDollars?: { total?: number } };
      const results = (body.results ?? []).map((r) => ({
        title: r.title || r.url,
        url: r.url,
        snippet: snippetOf(r.highlights?.length ? r.highlights.join(HIGHLIGHT_JOIN) : (r.text ?? '')),
        date: r.publishedDate ? r.publishedDate.slice(0, DATE_LENGTH) : null
      }));
      return { ok: true, results, costUsd: body.costDollars?.total ?? 0 };
    } catch (e) {
      return failed(e);
    }
  };
}

export type ExaPage = { ok: true; url: string; title: string; text: string; image: string | null; favicon: string | null; costUsd: number } | { ok: false; error: string };

type ExaContents = { results?: (ExaResult & { image?: string; favicon?: string })[]; statuses?: { id: string; status: string; error?: { tag?: string } }[]; costDollars?: { total?: number } };

export async function exaPage(apiKey: string, url: string, http: typeof fetch = fetch): Promise<ExaPage> {
  try {
    const body = (await posted(http, EXA_CONTENTS_URL, { 'x-api-key': apiKey }, { urls: [url], text: { maxCharacters: CONTENTS_MAX_CHARS }, livecrawl: 'fallback' })) as ExaContents;
    const page = body.results?.[0];
    if (!page?.text) {
      const status = body.statuses?.[0];
      return { ok: false, error: `Exa could not read it (${status?.error?.tag ?? status?.status ?? 'no text'})` };
    }
    return { ok: true, url: page.url, title: page.title || page.url, text: page.text, image: page.image ?? null, favicon: page.favicon ?? null, costUsd: body.costDollars?.total ?? 0 };
  } catch (e) {
    return { ok: false, error: `Exa failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

type Gateway = { baseUrl: string; apiKey: string; model: string };
type Citation = { url_citation?: { url?: string; title?: string; content?: string } };

export function openRouterSearch(gateway: Gateway, http: typeof fetch = fetch): SearchPort {
  return async (query, max) => {
    try {
      const body = (await posted(http, `${gateway.baseUrl}/chat/completions`, { authorization: `Bearer ${gateway.apiKey}` }, {
        model: gateway.model,
        messages: [{ role: 'user', content: `Search the web for: ${query}. List the sources you found.` }],
        plugins: [{ id: 'web', max_results: max }],
        usage: { include: true }
      })) as { choices?: { message?: { annotations?: Citation[] } }[]; usage?: { cost?: number } };
      const seen = new Set<string>();
      const results = (body.choices?.[0]?.message?.annotations ?? []).flatMap((a) => {
        const c = a.url_citation;
        if (!c?.url || seen.has(c.url)) {
          return [];
        }
        seen.add(c.url);
        return [{ title: c.title || c.url, url: c.url, snippet: snippetOf(c.content ?? ''), date: null }];
      });
      return { ok: true, results: results.slice(0, max), costUsd: body.usage?.cost ?? 0 };
    } catch (e) {
      return failed(e);
    }
  };
}

export function searchEngineOf(env: Record<string, string | undefined>): SearchEngine {
  return env.EXA_API_KEY?.trim() ? SearchEngine.Exa : SearchEngine.Gateway;
}
