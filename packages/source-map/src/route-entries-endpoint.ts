import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, dirname, join, relative, resolve } from 'node:path';
import type { ViteDevServer } from 'vite';

export const ENTRIES_ROUTE = '/__feega/route-entries';

const BAD_REQUEST = 400;
const TIMEOUT_MS = 5000;
const ROUTES_DIR = 'routes';
const GENERATORS = ['entries', 'getStaticPaths'];
const PAGE_MODULES = ['+page.ts', '+page.js', '+page.server.ts', '+page.server.js'];
const LAYOUT_MODULES = ['+layout.ts', '+layout.js', '+layout.server.ts', '+layout.server.js'];

type Params = Record<string, string>;
type Answer = { entries: Params[]; reasons: string[] };
type Generator = (arg: unknown) => unknown;

const ancestorsOf = (dir: string, root: string): string[] => {
  if (relative(root, dir).startsWith('..') || basename(dir) === ROUTES_DIR || dir === dirname(dir)) {
    return [];
  }

  return [dir, ...ancestorsOf(dirname(dir), root)];
};

const SVELTEKIT_PAGE = (file: string, root: string): string[] => [
  ...PAGE_MODULES.map((name) => join(dirname(file), name)),
  ...ancestorsOf(dirname(file), root).flatMap((dir) => LAYOUT_MODULES.map((name) => join(dir, name)))
];

const MODULE_ROWS: { matches: (file: string) => boolean; modules: (file: string, root: string) => string[] }[] = [
  { matches: (file) => basename(file) === '+page.svelte', modules: SVELTEKIT_PAGE },
  { matches: (file) => file.endsWith('.astro'), modules: (file) => [file] }
];

const modulesOf = (file: string, root: string): string[] =>
  (MODULE_ROWS.find((row) => row.matches(file))?.modules(file, root) ?? []).filter((path) => existsSync(path));

const textOf = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return Array.isArray(value) && value.every((part) => typeof part === 'string' || typeof part === 'number') ? value.join('/') : null;
};

function paramsOf(row: unknown): Params | null {
  const source = (row as { params?: unknown } | null)?.params ?? row;
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }
  const pairs = Object.entries(source).map(([name, value]) => [name, textOf(value)] as const);

  return pairs.every(([, value]) => value !== null) ? Object.fromEntries(pairs as [string, string][]) : null;
}

function timeout(): { expired: Promise<never>; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS);
  });

  return { expired, stop: () => clearTimeout(timer) };
}

async function rowsOf(server: ViteDevServer, path: string): Promise<unknown[]> {
  const loaded = await server.ssrLoadModule(path);
  const name = GENERATORS.find((candidate) => typeof loaded[candidate] === 'function');
  if (!name) {
    return [];
  }
  const rows = await (loaded[name] as Generator)({ paginate: () => [] });

  return Array.isArray(rows) ? rows : [];
}

async function answerFor(server: ViteDevServer, root: string, file: string): Promise<Answer> {
  const answer: Answer = { entries: [], reasons: [] };

  for (const path of modulesOf(resolve(root, file), resolve(root))) {
    const clock = timeout();
    try {
      const rows = await Promise.race([rowsOf(server, path), clock.expired]);
      answer.entries.push(...rows.map(paramsOf).filter((params): params is Params => params !== null));
    } catch (error) {
      answer.reasons.push(`${relative(root, path)}: ${(error as Error)?.message ?? error}`);
    } finally {
      clock.stop();
    }
  }

  return answer;
}

const insideRoot = (root: string, file: string) => !relative(resolve(root), resolve(root, file)).startsWith('..');

function reply(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(body);
}

export function routeEntries(server: ViteDevServer, root: () => string) {
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const file = new URL(req.url ?? '/', 'http://localhost').searchParams.get('file');
    if (!file || !insideRoot(root(), file)) {
      reply(res, BAD_REQUEST, JSON.stringify({ entries: [], reasons: ['bad request'] }));
      return;
    }
    reply(res, 200, JSON.stringify(await answerFor(server, root(), file)));
  }

  server.middlewares.use(ENTRIES_ROUTE, (req, res, next) => void handle(req, res).catch(next));
}
