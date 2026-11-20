import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { detectLibrary, type IconLibrary } from '@feega/live-edit/icon-library';
import { IconSource, type IconHit } from '../messages';

export { IconSource };

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const ICONMCP_URL = 'https://iconmcp.com/mcp';
const ICON_FILE = /\.(m?js|svelte)$/;
const SVG = /<svg[\s\S]*<\/svg>/;
const REQUEST_TIMEOUT_MS = 10_000;

type McpText = { type: string; text: string };

async function mcpCall(fetcher: Fetcher, tool: string, args: Record<string, unknown>): Promise<McpText[]> {
  const response = await fetcher(ICONMCP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`iconmcp answered ${response.status}`);
  }
  const raw = await response.text();
  const data = raw.startsWith('{') ? raw : (raw.split('\n').find((line) => line.startsWith('data:'))?.slice('data:'.length) ?? '');
  const body = JSON.parse(data) as { result?: { content?: McpText[] }; error?: { message: string } };
  if (body.error) {
    throw new Error(body.error.message);
  }
  return body.result?.content ?? [];
}

export async function mcpSearch(fetcher: Fetcher, query: string, limit: number): Promise<IconHit[]> {
  const [first] = await mcpCall(fetcher, 'search_icons', { query, limit });
  const found = JSON.parse(first?.text ?? '{}') as { results?: { name: string; label?: string }[] };
  return (found.results ?? []).map(({ name, label }) => ({ name, label, source: IconSource.IconMcp }));
}

export async function mcpIcon(fetcher: Fetcher, name: string, size: number, stroke: number): Promise<string> {
  const content = await mcpCall(fetcher, 'get_icon', { name, size, stroke });
  const svg = content.map((c) => c.text.match(SVG)?.[0]).find(Boolean);
  if (!svg) {
    throw new Error(`iconmcp has no icon named ${name}`);
  }
  return svg;
}

async function firstListing(root: string, library: IconLibrary): Promise<string[]> {
  for (const dir of library.dirs) {
    const files = await readdir(join(root, 'node_modules', library.pkg, dir)).catch(() => null);
    if (files) {
      return files.filter((file) => ICON_FILE.test(file));
    }
  }
  return [];
}

export async function libraryHits(root: string, library: IconLibrary, query: string, limit: number): Promise<IconHit[]> {
  const needle = query.trim().toLowerCase();
  const names = (await firstListing(root, library)).map(library.nameOf).filter((name) => name.includes(needle));
  return [...new Set(names)]
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, limit)
    .map((name) => ({ name, source: IconSource.Library }));
}

const SEARCH_LIMIT = 40;

export type IconSearch = { library: string | null; hits: IconHit[]; error?: string };

export async function searchIcons(root: string, fetcher: Fetcher, query: string): Promise<IconSearch> {
  const manifest = await readFile(join(root, 'package.json'), 'utf8').catch(() => '');
  const library = detectLibrary(manifest);
  const own = library ? await libraryHits(root, library, query, SEARCH_LIMIT) : [];
  const remote = await mcpSearch(fetcher, query, SEARCH_LIMIT).then(
    (hits) => ({ hits }),
    (error: Error) => ({ hits: [] as IconHit[], error: error.message })
  );
  return { library: library?.pkg ?? null, hits: [...own, ...remote.hits], error: remote.error };
}
