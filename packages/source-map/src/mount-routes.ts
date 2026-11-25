import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve, sep } from 'node:path';
import type { ViteDevServer } from 'vite';
import { renderAstro } from './astro-render.ts';
import { adapterOf, seededProps } from './mount-adapters.ts';
import { ASTRO_ROUTE, MODULE_ROUTE, MOUNT_ROUTE, PROPS_ROUTE, PROVIDERS_QUERY, mountHtml, mountRequestOf } from './mount-page.ts';
import { fsUrl } from './source-id.ts';

const BAD_REQUEST = 400;
const SERVER_ERROR = 500;
const RUNTIME_FILE = 'mount-runtime.js';
const DOM_RUNTIME_FILE = 'mount-dom.js';
const ENTRY_SCRIPT = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
const MODULE_TYPE = /\btype=["']module["']/i;

type Routes = { root: () => string; runtimeDir: string };

export async function entryOf(root: string): Promise<string | null> {
  const html = await readFile(join(root, 'index.html'), 'utf8').catch(() => '');
  const tag = [...html.matchAll(ENTRY_SCRIPT)].find((match) => MODULE_TYPE.test(match[0]));
  return tag ? tag[1].replace(/^\//, '') : null;
}

const inside = (root: string, file: string) => resolve(root, file).startsWith(resolve(root) + sep);

function reply(res: ServerResponse, status: number, type: string, body: string) {
  res.statusCode = status;
  res.setHeader('content-type', type);
  res.end(body);
}

export function mountRoutes(server: ViteDevServer, { root, runtimeDir }: Routes) {
  const urlOf = (req: IncomingMessage) => new URL(req.url ?? '/', 'http://localhost');

  async function props(req: IncomingMessage, res: ServerResponse) {
    const request = mountRequestOf(urlOf(req));
    if (!request || !inside(root(), request.file)) {
      reply(res, BAD_REQUEST, 'text/plain', 'bad request');
      return;
    }
    const file = resolve(root(), request.file);
    const code = await readFile(file, 'utf8').catch(() => null);
    const controls = code === null ? null : adapterOf(request.file).controls(code, file, request.name, root());
    reply(res, 200, 'application/json', JSON.stringify({ controls }));
  }

  async function page(request: NonNullable<ReturnType<typeof mountRequestOf>>) {
    const entry = await entryOf(root());
    const sameRoot = resolve(root()) === resolve(server.config.root);
    return {
      request,
      page: {
        runtimeUrl: fsUrl(join(runtimeDir, RUNTIME_FILE)),
        domRuntimeUrl: fsUrl(join(runtimeDir, DOM_RUNTIME_FILE)),
        componentUrl: sameRoot ? `/${request.file}` : fsUrl(resolve(root(), request.file)),
        providersUrl: entry && existsSync(join(root(), entry)) ? `/${entry}?${PROVIDERS_QUERY}` : null
      }
    };
  }

  async function seeded(request: NonNullable<ReturnType<typeof mountRequestOf>>, adapter: ReturnType<typeof adapterOf>) {
    const file = resolve(root(), request.file);
    const code = await readFile(file, 'utf8').catch(() => null);
    const controls = code === null ? null : adapter.controls(code, file, request.name, root());
    return { ...request, props: seededProps(controls, request.props) };
  }

  async function mount(req: IncomingMessage, res: ServerResponse) {
    const url = urlOf(req);
    const request = mountRequestOf(url);
    if (!request || !inside(root(), request.file)) {
      reply(res, BAD_REQUEST, 'text/plain', 'bad request');
      return;
    }
    reply(res, 200, 'text/html', await server.transformIndexHtml(MOUNT_ROUTE, mountHtml(url.search.slice(1))));
  }

  async function astro(req: IncomingMessage, res: ServerResponse) {
    const request = mountRequestOf(urlOf(req));
    if (!request || !inside(root(), request.file)) {
      reply(res, BAD_REQUEST, 'text/plain', 'bad request');
      return;
    }
    try {
      reply(res, 200, 'text/html', await renderAstro(server, root(), request.file, request.props));
    } catch (error) {
      reply(res, SERVER_ERROR, 'text/plain', String((error as Error)?.message ?? error));
    }
  }

  server.middlewares.use(PROPS_ROUTE, (req, res, next) => void props(req, res).catch(next));
  server.middlewares.use(ASTRO_ROUTE, (req, res, next) => void astro(req, res).catch(next));
  server.middlewares.use(MOUNT_ROUTE, (req, res, next) => void mount(req, res).catch(next));

  return {
    async moduleFor(id: string): Promise<string | null> {
      const request = mountRequestOf(new URL(id, 'http://localhost'));
      if (!request || !inside(root(), request.file)) {
        return null;
      }
      const adapter = adapterOf(request.file);
      const resolved = await page(adapter.seedsProps ? await seeded(request, adapter) : request);
      return adapter.module(resolved.request, resolved.page);
    }
  };
}

export const isMountModule = (id: string) => id.startsWith(MODULE_ROUTE);
