import { TOKENS_CSS } from '$lib/site/templates/sources';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () => new Response(TOKENS_CSS, { headers: { 'content-type': 'text/css; charset=utf-8' } });
