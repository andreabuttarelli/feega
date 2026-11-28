import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { assignExamples, fillRoute } from '../route-match';
import { Scopes, scriptOf } from './module-scope';
import { linksOf } from './route-links';
import { entriesOf, hasGenerator } from './route-entries';
import { pageOfFile, type PageRoute } from './page-route';
import { listFiles } from './project-scan';
import { NOISY_FILE, isPlaceholder } from './route-noise';

const LINK_FILE = /\.(svelte|tsx|jsx|vue|astro|md|mdx|ts|js|html)$/;
const MAX_FILES = 2000;
const MAX_BYTES = 256_000;
const EXAMPLES_PER_ROUTE = 50;
const PAGE_SIBLINGS: Record<string, string[]> = {
  '+page.svelte': ['+page.ts', '+page.js', '+page.server.ts', '+page.server.js']
};

type Cached = { mtimeMs: number; links: string[] };

const linkCache = new Map<string, Cached>();

async function linksIn(file: string): Promise<string[]> {
  const info = await stat(file).catch(() => null);
  if (!info || info.size > MAX_BYTES) {
    return [];
  }
  const cached = linkCache.get(file);
  if (cached?.mtimeMs === info.mtimeMs) {
    return cached.links;
  }
  const links = linksOf(await readFile(file, 'utf8').catch(() => ''));
  linkCache.set(file, { mtimeMs: info.mtimeMs, links });

  return links;
}

async function linkedPaths(appRoot: string): Promise<string[]> {
  const files = (await listFiles(appRoot, LINK_FILE, MAX_FILES)).filter((file) => !NOISY_FILE.test(relative(appRoot, file)));
  const found = await Promise.all(files.map(linksIn));

  return [...new Set(found.flat())];
}

const generatorFiles = (file: string): string[] => [file, ...(PAGE_SIBLINGS[basename(file)] ?? []).map((name) => join(dirname(file), name))];

async function entryPaths(appRoot: string, route: string, files: string[]): Promise<string[]> {
  const scopes = new Scopes(appRoot);
  const found: string[] = [];

  for (const file of files.flatMap(generatorFiles)) {
    const text = await readFile(join(appRoot, file), 'utf8').catch(() => null);
    const script = text === null ? '' : scriptOf(file, text);
    if (text === null || !hasGenerator(script)) {
      continue;
    }
    const lookup = await scopes.lookup(file, text, 0, [file]);
    for (const params of entriesOf(script, lookup)) {
      found.push(fillRoute(route, params) ?? []);
    }
  }

  return found.flat();
}

export async function withSourced(appRoot: string, files: string[], routes: PageRoute[]): Promise<PageRoute[]> {
  const dynamic = routes.filter((page) => page.dynamic);
  if (dynamic.length === 0) {
    return routes;
  }
  const declared = new Set(routes.map((page) => page.route));
  const linked = assignExamples(
    dynamic.map((page) => page.route),
    (await linkedPaths(appRoot)).filter((path) => !declared.has(path))
  );
  const withExamples = new Map<string, string[]>();

  for (const page of dynamic) {
    const own = files.filter((file) => pageOfFile(file)?.route === page.route);
    const paths = [...new Set([...(await entryPaths(appRoot, page.route, own)), ...linked[page.route].filter((path) => !isPlaceholder(page.route, path))])].slice(0, EXAMPLES_PER_ROUTE);
    if (paths.length > 0) {
      withExamples.set(page.route, paths);
    }
  }

  return routes.map((page) => (withExamples.has(page.route) ? { ...page, sourced: withExamples.get(page.route) } : page));
}
