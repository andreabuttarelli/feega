const MAX_HEADINGS = 12;

const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const first = (html: string, pattern: RegExp) => pattern.exec(html)?.[1]?.trim() ?? '';

export async function siteFacts(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  const title = strip(first(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = first(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || first(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const headings = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)].map((m) => strip(m[1])).filter(Boolean).slice(0, MAX_HEADINGS);
  const colours = [...new Set([...html.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()))].slice(0, 6);

  return ['Facts read from the site (the same text is given to every agent):', `title: ${title}`, `description: ${description}`, `headings: ${headings.join(' | ')}`, `colours seen in the page: ${colours.join(', ')}`].join('\n');
}
