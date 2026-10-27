import { getCollection } from 'astro:content';

const GUIDE_SECTIONS = ['getting-started', 'canvas', 'motion', 'ai', 'integrations', 'self-hosting'];

export async function GET() {
  const pages = await getCollection('docs');
  const guides = pages
    .map((page) => ({ path: page.id, title: page.data.title, order: page.data.sidebar?.order ?? 999 }))
    .filter((page) => GUIDE_SECTIONS.includes(page.path.split('/')[0]))
    .sort((a, b) => GUIDE_SECTIONS.indexOf(a.path.split('/')[0]) - GUIDE_SECTIONS.indexOf(b.path.split('/')[0]) || a.order - b.order)
    .map(({ path, title }) => ({ path, title, section: path.split('/')[0] }));
  return new Response(JSON.stringify(guides), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
