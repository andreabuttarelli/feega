import { PREVIEWABLE, templateById } from '$lib/site/templates/library';
import { previewDocument } from '$lib/site/templates/preview';
import { TOKENS_CSS, previewParts } from '$lib/site/templates/sources';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => PREVIEWABLE.map((t) => ({ id: t.id }));

export const GET: RequestHandler = async ({ params }) => {
  const template = templateById(params.id)!;
  const html = previewDocument(template, await previewParts(template), TOKENS_CSS);

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
