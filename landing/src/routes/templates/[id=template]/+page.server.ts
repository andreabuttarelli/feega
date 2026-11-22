import { factsOf } from '$lib/site/templates/guide';
import { TEMPLATES, templateById } from '$lib/site/templates/library';
import { TOKENS_CSS, codeOf, previewParts } from '$lib/site/templates/sources';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => TEMPLATES.map((t) => ({ id: t.id }));

export const load: PageServerLoad = async ({ params }) => {
  const template = templateById(params.id)!;
  const [code, parts] = await Promise.all([codeOf(template), previewParts(template.id)]);

  return { template, code, tokensCss: TOKENS_CSS, facts: factsOf(template, parts, code) };
};
