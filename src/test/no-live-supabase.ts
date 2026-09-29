import { afterEach } from 'vitest';

const LIVE_HOST = /\.supabase\.co$/;
const SERVICE_UNAVAILABLE = 503;

const reached: string[] = [];
const realFetch = globalThis.fetch;

globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!LIVE_HOST.test(url.hostname)) {
    return realFetch(input, init);
  }
  reached.push(`${init?.method ?? 'GET'} ${url.pathname}`);
  return Promise.resolve(new Response(JSON.stringify({ message: 'live Supabase is off limits in tests' }), { status: SERVICE_UNAVAILABLE }));
};

afterEach(() => {
  if (!reached.length) {
    return;
  }
  const calls = reached.splice(0);
  throw new Error(`test reached the live Supabase project: ${calls.join(', ')}`);
});
