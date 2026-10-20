import { env } from '$env/dynamic/public';
import { grantedAssetPaths } from '$lib/canvas/asset-url';

const BUNDLE_DIR = '/_app/';
const FILE_NAME = /\/[^/]+\.[a-z0-9]+$/i;
const JSON_TYPE = 'application/json';
const BODILESS = new Set(['GET', 'HEAD']);

function originOf(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

export function serverUrlOf(url: URL, appOrigin: string, apiBase: string): string | null {
  if (originOf(url) !== appOrigin || url.pathname.startsWith(BUNDLE_DIR) || FILE_NAME.test(url.pathname)) {
    return null;
  }
  return `${apiBase}${url.pathname}${url.search}`;
}

function urlOf(input: RequestInfo | URL): URL {
  const raw = input instanceof Request ? input.url : String(input);
  return new URL(raw, location.href);
}

async function withGrantedAssets(response: Response): Promise<Response> {
  if (!(response.headers.get('content-type') ?? '').includes(JSON_TYPE)) {
    return response;
  }
  return new Response(grantedAssetPaths(await response.text()), { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function sendServerCallsTo(apiBase: string, bearer: () => Promise<string | null>): void {
  const local = window.fetch.bind(window);
  const apiOrigin = originOf(new URL(apiBase));

  window.fetch = async (input, init) => {
    const url = urlOf(input);
    const target = serverUrlOf(url, originOf(new URL(location.href)), apiBase);
    if (!target) {
      const response = await local(input, init);
      return originOf(url) === apiOrigin ? withGrantedAssets(response) : response;
    }

    const request = new Request(input instanceof Request ? input : target, init);
    const headers = new Headers(request.headers);
    const token = await bearer();
    if (token && !headers.has('authorization')) {
      headers.set('authorization', `Bearer ${token}`);
    }
    const body = BODILESS.has(request.method) ? undefined : await request.arrayBuffer();
    return withGrantedAssets(await local(target, { method: request.method, headers, body, signal: request.signal }));
  };
}

export function bundleApiBase(): string | null {
  const base = env.PUBLIC_API_BASE;
  return base && base !== location.origin ? base : null;
}
