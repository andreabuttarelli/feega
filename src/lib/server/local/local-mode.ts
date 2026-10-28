import { json, redirect, type RequestEvent, type ResolveOptions } from '@sveltejs/kit';
import { stringify } from 'devalue';
import { hasAiKey } from '$lib/local-ai-keys';
import { LOCAL_USER, openFeegaStore, type FeegaStore, type LocalPlace } from './feega-store';

type Env = Record<string, string | undefined>;
type Resolve = (event: RequestEvent, opts?: ResolveOptions) => Response | Promise<Response>;

export const LOCAL_FILE_ENV = 'FEEGA_LOCAL_FILE';
export const LOCAL_TOKEN = 'local';
export const LOCAL_AI_MESSAGE = 'AI generation runs on feega cloud. Import this .feega file at feega.app to generate.';

const LOOPBACK = ['localhost', '127.0.0.1', '::1', '[::1]'];
const SEE_OTHER = 303;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const ACTION_QUERY = /^\?\/(\w+)/;

export enum LocalRoute {
  Canvas = 'canvas',
  Api = 'api',
  Local = 'local',
  Runtime = 'runtime',
  Home = 'home',
  Gone = 'gone'
}

const ROUTES: { route: LocalRoute; matches: (path: string, canvas: string) => boolean }[] = [
  { route: LocalRoute.Canvas, matches: (path, canvas) => path === canvas || path.startsWith(`${canvas}/`) },
  { route: LocalRoute.Api, matches: (path) => path.startsWith('/api/v1/') },
  { route: LocalRoute.Local, matches: (path) => path.startsWith('/local/') },
  { route: LocalRoute.Runtime, matches: (path) => ['/motion-runtime', '/motion-libs', '/motion-env', '/render', '/embed.js'].some((p) => path === p || path.startsWith(`${p}/`)) },
  { route: LocalRoute.Home, matches: (path) => path === '/' || path.startsWith('/p/') || path.startsWith('/app') || path === '/login' }
];

const CLOUD_ONLY = 'needs feega cloud. Import this .feega file at feega.app to use it.';

const ONE_FILE = 'Local mode works on one .feega file. To open another, restart with: npm run local -- <file>.feega';

export const CLOUD_ONLY_ACTIONS: Record<string, string> = {
  import_canvas_file: ONE_FILE,
  request_canvas_import: ONE_FILE,
  share: `Sharing ${CLOUD_ONLY}`,
  share_canvas: `Sharing ${CLOUD_ONLY}`,
  addComment: `Comments ${CLOUD_ONLY}`,
  editComment: `Comments ${CLOUD_ONLY}`,
  deleteComment: `Comments ${CLOUD_ONLY}`,
  resolveComment: `Comments ${CLOUD_ONLY}`,
  saveCanvasVersion: `Saved versions ${CLOUD_ONLY}`,
  restoreCanvasVersion: `Saved versions ${CLOUD_ONLY}`,
  new_canvas: `More canvases ${CLOUD_ONLY}`,
  delete_canvas: `Deleting the canvas ${CLOUD_ONLY}`
};

const PLACE_KEYS: Record<string, keyof LocalPlace> = {
  projectId: 'projectId',
  project_id: 'projectId',
  project: 'projectId',
  canvasId: 'canvasId',
  canvas_id: 'canvasId',
  canvas: 'canvasId'
};

export function localModeRefusal(env: Env): string | null {
  if (!env[LOCAL_FILE_ENV]) {
    return null;
  }
  if (env.VERCEL) {
    return `${LOCAL_FILE_ENV} refuses to run on Vercel: local mode has no login.`;
  }
  const host = env.HOST ?? '0.0.0.0';
  if (!LOOPBACK.includes(host)) {
    return `${LOCAL_FILE_ENV} needs HOST on localhost or 127.0.0.1 (got ${host}): local mode has no login, so it must not listen on the network.`;
  }
  const app = env.PUBLIC_APP_URL ? new URL(env.PUBLIC_APP_URL).hostname : LOOPBACK[0];
  if (!LOOPBACK.includes(app)) {
    return `${LOCAL_FILE_ENV} needs PUBLIC_APP_URL on localhost (got ${env.PUBLIC_APP_URL}).`;
  }
  return null;
}

let store: FeegaStore | null | undefined;

export function localStore(env: Env = process.env): FeegaStore | null {
  if (store !== undefined) {
    return store;
  }
  const path = env[LOCAL_FILE_ENV];
  if (!path) {
    store = null;
    return store;
  }
  const refusal = localModeRefusal(env);
  if (refusal) {
    throw new Error(refusal);
  }
  const opened = openFeegaStore(path, { origin: env.PUBLIC_APP_URL ?? 'http://localhost:5173' });
  process.once('exit', () => opened.flushNow());
  store = opened;
  if (hasAiKey(env)) {
    void syncModels(opened, env);
    void reportKeys(env);
    void import('./local-ticker').then(({ startLocalTicker }) => startLocalTicker(opened.db));
  }
  return store;
}

async function syncModels(opened: FeegaStore, env: Env): Promise<void> {
  const { syncLocalModels } = await import('./local-models');
  const outcome = await syncLocalModels(opened.db, env).catch((e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : String(e) }));
  console.log(outcome.ok ? `feega local: ${outcome.synced} models available` : `feega local: model list unavailable (${outcome.reason})`);
}

async function reportKeys(env: Env): Promise<void> {
  const { checkLocalKeys } = await import('./key-checks');
  const checks = await checkLocalKeys(env).catch(() => []);
  checks.forEach(({ provider, verdict }) => console.log(`feega local: ${provider} key ${verdict}`));
}

export const canvasPath = (place: LocalPlace) => `/p/${place.projectId}/c/${place.canvasId}`;

export function localRoute(pathname: string, place: LocalPlace): LocalRoute {
  return ROUTES.find((r) => r.matches(pathname, canvasPath(place)))?.route ?? LocalRoute.Gone;
}

function foreignPlace(asked: unknown, place: LocalPlace): boolean {
  if (Array.isArray(asked)) {
    return asked.some((item) => foreignPlace(item, place));
  }
  if (!asked || typeof asked !== 'object') {
    return false;
  }
  return Object.entries(asked).some(([key, value]) => {
    const field = PLACE_KEYS[key];
    return typeof value === 'string' ? field !== undefined && value !== place[field] : foreignPlace(value, place);
  });
}

async function bodyOf(event: RequestEvent): Promise<unknown> {
  return event.request.headers.get('content-type')?.includes('json') ? event.request.clone().json().catch(() => null) : null;
}

function refusedAction(message: string): Response {
  return json({ type: 'failure', status: FORBIDDEN, data: stringify({ error: 'local_mode', message }) });
}

async function serveApi(event: RequestEvent, resolve: Resolve, place: LocalPlace): Promise<Response> {
  const body = await bodyOf(event);
  if (foreignPlace([body, Object.fromEntries(event.url.searchParams), event.params], place)) {
    return json({ error: 'outside_local_canvas', message: `Local mode serves one canvas: project ${place.projectId}, canvas ${place.canvasId}.` }, { status: FORBIDDEN });
  }
  const op = body && typeof body === 'object' ? (body as { op?: unknown }).op : undefined;
  const refusal = typeof op === 'string' ? CLOUD_ONLY_ACTIONS[op] : undefined;
  if (refusal) {
    return json({ error: 'local_mode', message: refusal }, { status: FORBIDDEN });
  }
  event.request.headers.set('authorization', `Bearer ${LOCAL_TOKEN}`);
  return resolve(event);
}

export async function serveLocal(event: RequestEvent, resolve: Resolve, local: FeegaStore): Promise<Response> {
  const route = localRoute(event.url.pathname, local.place);
  if (route === LocalRoute.Home) {
    redirect(SEE_OTHER, canvasPath(local.place));
  }
  if (route === LocalRoute.Gone) {
    return new Response('Not available in local mode', { status: NOT_FOUND });
  }
  if (route === LocalRoute.Api) {
    return serveApi(event, resolve, local.place);
  }
  const action = ACTION_QUERY.exec(event.url.search)?.[1];
  const refusal = event.request.method === 'POST' && action ? CLOUD_ONLY_ACTIONS[action] : undefined;
  if (refusal) {
    return refusedAction(refusal);
  }
  return resolve(event);
}

export function localSession() {
  const session = { access_token: LOCAL_TOKEN, refresh_token: LOCAL_TOKEN, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: LOCAL_USER };
  return { session, user: LOCAL_USER } as unknown as { session: App.Locals['session']; user: App.Locals['user'] };
}
