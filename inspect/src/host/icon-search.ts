import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { detectLibrary, type IconLibrary } from '@feega/live-edit/icon-library';
import { IconSource, type IconHit } from '../messages';
import { svgOfModule } from './icon-node';
import { rankNames, suggestNames } from './icon-rank';

export { IconSource };

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const ICONMCP_URL = 'https://iconmcp.com/mcp';
const ICON_FILE = /\.(m?js|svelte)$/;
const SVG = /<svg[\s\S]*<\/svg>/;
const REQUEST_TIMEOUT_MS = 10_000;
const DRAW_BATCH = 40;

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
  const body = JSON.parse(data) as { result?: { content?: McpText[]; isError?: boolean }; error?: { message: string } };
  if (body.error) {
    throw new Error(body.error.message);
  }
  const content = body.result?.content ?? [];
  if (body.result?.isError) {
    throw new Error(content.map((c) => c.text).join(' ') || 'iconmcp failed');
  }
  return content;
}

export async function mcpSearch(fetcher: Fetcher, query: string, limit: number): Promise<IconHit[]> {
  if (!query.trim()) {
    return [];
  }

  const [first] = await mcpCall(fetcher, 'search_icons', { query: query.trim(), limit });
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

type Listing = { dir: string; files: string[] };

async function firstListing(root: string, library: IconLibrary): Promise<Listing | null> {
  for (const dir of library.dirs) {
    const path = join(root, 'node_modules', library.pkg, dir);
    const files = await readdir(path).catch(() => null);
    if (files) {
      return { dir: path, files: files.filter((file) => ICON_FILE.test(file)) };
    }
  }
  return null;
}

export async function libraryHits(root: string, library: IconLibrary, query: string, limit: number, current: string | null): Promise<IconHit[]> {
  const listing = await firstListing(root, library);
  const fileOf = new Map((listing?.files ?? []).map((file) => [library.nameOf(file), file]));
  const names = [...fileOf.keys()];
  const ranked = query.trim() ? rankNames(names, query, current) : suggestNames(names, current);

  const hits: IconHit[] = [];
  for (let from = 0; from < ranked.length && hits.length < limit; from += DRAW_BATCH) {
    const batch = ranked.slice(from, from + DRAW_BATCH);
    const drawn = await Promise.all(batch.map((name) => svgOfModule(join(listing!.dir, fileOf.get(name)!))));
    batch.forEach((name, i) => drawn[i] && hits.push({ name, source: IconSource.Library, svg: drawn[i]! }));
  }
  return hits.slice(0, limit);
}

export const LIBRARY_GRID_LIMIT = 120;
const REMOTE_LIMIT = 48;

export type IconSearch = { library: string | null; hits: IconHit[]; error?: string };

async function remoteHits(fetcher: Fetcher, query: string): Promise<{ hits: IconHit[]; error?: string }> {
  try {
    return { hits: await mcpSearch(fetcher, query, REMOTE_LIMIT) };
  } catch (error) {
    return { hits: [], error: (error as Error).message };
  }
}

export async function searchIcons(root: string, fetcher: Fetcher, query: string, current: string | null): Promise<IconSearch> {
  const manifest = await readFile(join(root, 'package.json'), 'utf8').catch(() => '');
  const library = detectLibrary(manifest);
  const own = library ? await libraryHits(root, library, query, LIBRARY_GRID_LIMIT, current) : [];
  const remote = await remoteHits(fetcher, query.trim() || current || '');
  return { library: library?.pkg ?? null, hits: [...own, ...remote.hits], error: remote.error };
}
