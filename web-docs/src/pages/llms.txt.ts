import { getCollection } from 'astro:content';

const SITE = 'https://docs.feega.app';

export async function GET() {
  const pages = (await getCollection('docs')).sort((a, b) => a.id.localeCompare(b.id));
  const urlOf = (id: string) => `${SITE}/${id === 'index' ? '' : `${id.replace(/\/index$/, '')}/`}`;
  const lines = pages.map((p) => `- [${p.data.title}](${urlOf(p.id)}): ${p.data.description ?? ''}`);
  const body = [
    '# Feega docs',
    '> Feega is a free, open-source (Apache-2.0) VS Code extension to design in your codebase: click any element of your running app, edit it like in Figma, and the change is written to your source as a diff. No AI, no tokens. Also runs with `npx feega`.',
    '## Docs',
    lines.join('\n'),
    `Full text: ${SITE}/llms-full.txt`
  ].join('\n\n');
  return new Response(body + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
