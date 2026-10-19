import { deserialize } from '$app/forms';
import type { ActionResult } from '@sveltejs/kit';
import { apiCall, withOrg } from './client';
import { pageActionOf } from './page-answers';

const ACTION_PARAM = 'action';

const BEARER_PAGES: { page: RegExp; api: (m: RegExpExecArray) => string }[] = [
  { page: /^\/p\/([^/?#]+)\/c\/([^/?#]+)$/, api: (m) => `/api/v1/projects/${m[1]}/canvases/${m[2]}` },
  { page: /^\/p\/([^/?#]+)\/c\/([^/?#]+)\/motion\/([^/?#]+)$/, api: (m) => `/api/v1/projects/${m[1]}/canvases/${m[2]}/motion/${m[3]}` }
];

export function apiPathOf(pageUrl: string): string | null {
  for (const { page, api } of BEARER_PAGES) {
    const match = page.exec(pageUrl);
    if (match) {
      return api(match);
    }
  }
  return null;
}

export function pageActionPath(pageUrl: string, action: string): string {
  return `${pageUrl}${pageUrl.includes('?') ? '&' : '?'}/${action}`;
}

async function viaPage(pageUrl: string, action: string, form: FormData): Promise<ActionResult> {
  const res = await fetch(pageActionPath(pageUrl, action), { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
  return deserialize(await res.text());
}

export async function postPageAction(pageUrl: string, action: string, form: FormData): Promise<ActionResult> {
  const api = apiPathOf(pageUrl);
  if (!api) {
    return viaPage(pageUrl, action, form);
  }

  const { status, body } = await apiCall(withOrg(api, new URLSearchParams({ [ACTION_PARAM]: action })), { method: 'POST', body: form });
  return pageActionOf(status, body);
}
