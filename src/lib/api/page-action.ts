import { deserialize } from '$app/forms';
import { error, type ActionResult } from '@sveltejs/kit';
import { apiCall, withOrg } from './client';
import { pageActionOf, pageLoadOf } from './page-answers';
import { loadedOf, type Answer } from '$lib/dashboard/answers';
import { postApi } from '$lib/dashboard/api';
import { PAGE_PATH } from '$lib/dashboard/pages';
import { PROJECT_PAGE_PATH } from '$lib/project-pages';

const ACTION_PARAM = 'action';
const NOT_FOUND = 404;

type Reader = { post: (api: string, query: URLSearchParams, form: FormData) => Promise<ActionResult>; load: (status: number, body: Answer) => unknown };

async function postBare(api: string, query: URLSearchParams, form: FormData): Promise<ActionResult> {
  const { status, body } = await apiCall<Answer>(withOrg(api, query), { method: 'POST', body: form });
  return pageActionOf(status, body);
}

function postEnveloped(api: string, query: URLSearchParams, form: FormData): Promise<ActionResult> {
  const action = query.get(ACTION_PARAM) ?? '';
  query.delete(ACTION_PARAM);
  const search = query.toString();
  return postApi(search ? `${api}?${search}` : api, action, form);
}

const BARE: Reader = { post: postBare, load: pageLoadOf };
const ENVELOPED: Reader = { post: postEnveloped, load: loadedOf };

type Row = { page: RegExp; api: (m: RegExpExecArray) => string; reader: Reader };

const exactly = (path: string) => new RegExp(`^${path.replace(/\//g, '\\/')}$`);

const DASHBOARD_ROWS: Row[] = Object.entries(PAGE_PATH).map(([page, path]) => ({ page: exactly(path), api: () => `/api/v1/me/pages/${page}`, reader: ENVELOPED }));

const PROJECT_ROWS: Row[] = Object.entries(PROJECT_PAGE_PATH).map(([page, path]) => ({
  page: new RegExp(`^\\/p\\/([^/?#]+)\\/${path.replace(/\//g, '\\/')}$`),
  api: (m) => `/api/v1/projects/${m[1]}/pages/${page}`,
  reader: BARE
}));

const BEARER_PAGES: Row[] = [
  { page: /^\/p\/([^/?#]+)\/c\/([^/?#]+)$/, api: (m) => `/api/v1/projects/${m[1]}/canvases/${m[2]}`, reader: BARE },
  { page: /^\/p\/([^/?#]+)\/c\/([^/?#]+)\/motion\/([^/?#]+)$/, api: (m) => `/api/v1/projects/${m[1]}/canvases/${m[2]}/motion/${m[3]}`, reader: BARE },
  { page: /^\/app\/compose\/([^/?#]+)$/, api: (m) => `/api/v1/compose/${m[1]}`, reader: BARE },
  { page: /^\/app\/studio\/([^/?#]+)$/, api: (m) => `/api/v1/studio/${m[1]}`, reader: BARE },
  ...DASHBOARD_ROWS,
  ...PROJECT_ROWS
];

type Twin = { api: string; query: URLSearchParams; reader: Reader };

function twinOf(pageUrl: string): Twin | null {
  const url = new URL(pageUrl, 'https://page');
  for (const { page, api, reader } of BEARER_PAGES) {
    const match = page.exec(url.pathname);
    if (match) {
      return { api: api(match), query: url.searchParams, reader };
    }
  }
  return null;
}

export function hasTwin(pageUrl: string): boolean {
  return twinOf(pageUrl) !== null;
}

export function apiPathOf(pageUrl: string): string | null {
  const twin = twinOf(pageUrl);
  if (!twin) {
    return null;
  }
  const search = twin.query.toString();
  return search ? `${twin.api}?${search}` : twin.api;
}

export function pageActionPath(pageUrl: string, action: string): string {
  return `${pageUrl}${pageUrl.includes('?') ? '&' : '?'}/${action}`;
}

async function viaPage(pageUrl: string, action: string, form: FormData): Promise<ActionResult> {
  const res = await fetch(pageActionPath(pageUrl, action), { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
  return deserialize(await res.text());
}

export async function postPageAction(pageUrl: string, action: string, form: FormData): Promise<ActionResult> {
  const twin = twinOf(pageUrl);
  if (!twin) {
    return viaPage(pageUrl, action, form);
  }

  const query = new URLSearchParams(twin.query);
  query.set(ACTION_PARAM, action);
  return twin.reader.post(twin.api, query, form);
}

export async function loadPageData<T>(url: URL): Promise<T> {
  const twin = twinOf(url.pathname + url.search);
  if (!twin) {
    error(NOT_FOUND, 'not_found');
  }

  const { status, body } = await apiCall<Answer>(withOrg(twin.api, twin.query));
  return twin.reader.load(status, body) as T;
}

export async function loadApiData<T>(api: string): Promise<T> {
  const { status, body } = await apiCall<Answer>(withOrg(api));
  return pageLoadOf(status, body) as T;
}
