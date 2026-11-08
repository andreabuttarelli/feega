import { getCollection } from 'astro:content';

const SITE = 'https://docs.feega.app';

export async function GET() {
  const pages = (await getCollection('docs')).sort((a, b) => a.id.localeCompare(b.id));
  const urlOf = (id: string) => `${SITE}/${id === 'index' ? '' : `${id.replace(/\/index$/, '')}/`}`;
  const lines = pages.map((p) => `- [${p.data.title}](${urlOf(p.id)}): ${p.data.description ?? ''}`);
  const body = [
    '# Feega docs',
    '> Feega is motion design for Claude Code: an open-source infinite canvas that people and AI agents (Claude Code, Codex, Cursor) edit together through an MCP server and a CLI, then render to MP4, GIF or Lottie.',
    '## Connect Claude Code',
    'claude mcp add --transport http feega https://mcp.feega.app/mcp',
    '## Docs',
    lines.join('\n'),
    `Full text: ${SITE}/llms-full.txt`
  ].join('\n\n');
  return new Response(body + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
