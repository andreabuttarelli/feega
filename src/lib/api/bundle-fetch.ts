import { env } from '$env/dynamic/public';

const BUNDLE_DIR = '/_app/';
const FILE_NAME = /\/[^/]+\.[a-z0-9]+$/i;

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

export function sendServerCallsTo(apiBase: string, bearer: () => Promise<string | null>): void {
  const local = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const target = serverUrlOf(urlOf(input), originOf(new URL(location.href)), apiBase);
    if (!target) {
      return local(input, init);
    }

    const request = new Request(input instanceof Request ? input : target, init);
    const headers = new Headers(request.headers);
    const token = await bearer();
    if (token && !headers.has('authorization')) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return local(new Request(target, { method: request.method, headers, body: request.body, signal: request.signal, duplex: 'half' } as RequestInit));
  };
}

export function bundleApiBase(): string | null {
  const base = env.PUBLIC_API_BASE;
  return base && base !== location.origin ? base : null;
}
