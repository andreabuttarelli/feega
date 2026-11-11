import { getCollection } from 'astro:content';

const SECTIONS = ['getting-started', 'integrations', 'motion', 'canvas', 'ai', 'audio'];

export async function GET() {
  const pages = (await getCollection('docs'))
    .filter((p) => SECTIONS.includes(p.id.split('/')[0]))
    .sort((a, b) => SECTIONS.indexOf(a.id.split('/')[0]) - SECTIONS.indexOf(b.id.split('/')[0]) || a.id.localeCompare(b.id));
  const body = pages.map((p) => `# ${p.data.title}\nhttps://docs.feega.app/${p.id}/\n\n${p.body ?? ''}`).join('\n\n---\n\n');
  return new Response(body + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
