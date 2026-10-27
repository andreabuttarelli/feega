import { llmsFullTxt } from '$lib/site/llms';

export const prerender = true;

export const GET = () => new Response(llmsFullTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
