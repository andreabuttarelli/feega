import { deserialize } from '$app/forms';
import { error, type ActionResult } from '@sveltejs/kit';
import { apiCall, withOrg } from './client';
import { pageActionOf, pageLoadOf } from './page-answers';
import { actionResultOf, loadedOf, type Answer } from '$lib/dashboard/answers';

const ACTION_PARAM = 'action';
const NOT_FOUND = 404;

type Reader = { action: (status: number, body: Answer) => ActionResult; load: (status: number, body: Answer) => unknown };

const BARE: Reader = { action: pageActionOf, load: pageLoadOf };
const ENVELOPED: Reader = { action: actionResultOf, load: loadedOf };

const BEARER_PAGES: { page: RegExp; api: (m: RegExpExecArray) => string; reader: Reader }[] = [
  { page: /^\/p\/([^/?#]+)\/c\/([^/?#]+)$/, api: (m) => `/api/v1/projects/${m[1]}/canvases/${m[2]}`, reader: BARE },
  { page: /^\/p\/([^/?#]+)\/c\/([^/?#]+)\/motion\/([^/?#]+)$/, api: (m) => `/api/v1/projects/${m[1]}/canvases/${m[2]}/motion/${m[3]}`, reader: BARE },
  { page: /^\/app\/compose$/, api: () => '/api/v1/me/pages/compose', reader: ENVELOPED },
  { page: /^\/app\/compose\/([^/?#]+)$/, api: (m) => `/api/v1/compose/${m[1]}`, reader: BARE }
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
  const { status, body } = await apiCall<Answer>(withOrg(twin.api, query), { method: 'POST', body: form });
  return twin.reader.action(status, body);
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
