import script from '$lib/site/install.sh?raw';

export const prerender = true;

export function GET(): Response {
  return new Response(script, { headers: { 'content-type': 'text/x-shellscript; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
