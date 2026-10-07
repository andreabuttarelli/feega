export enum SectionKind {
  Hero = 'hero',
  Feature = 'feature',
  Steps = 'steps',
  Pricing = 'pricing',
  Faq = 'faq',
  Testimonial = 'testimonial',
  Audience = 'audience',
  Other = 'other'
}

export enum PageRole {
  Home = 'home',
  Inner = 'inner'
}

export type SiteSection = { kind: SectionKind; heading: string; lines: string[] };
export type SitePage = { url: string; title: string; sections: SiteSection[] };

const LINE_MAX = 240;
const LINES_PER_SECTION = 12;
const SECTIONS_PER_PAGE = 24;
const LINKS_KEPT = 4;

const BLOCK = /<(h[1-4]|p|li|summary|dt|dd|blockquote|figcaption|button|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const NOISE = /<(script|style|noscript|svg|template|nav|footer)\b[\s\S]*?<\/\1>/gi;
const HEADING = /^h[1-4]$/i;

const KIND_BY_WORDS: [SectionKind, RegExp][] = [
  [SectionKind.Pricing, /pric|plan|deal|cost|\$|€|£|free\b|per month|\/mo\b|license/i],
  [SectionKind.Faq, /faq|question|things to know|\?$/i],
  [SectionKind.Testimonial, /testimonial|customers say|loved by|reviews?\b|what people|trusted by/i],
  [SectionKind.Steps, /how it works|step|in \d+ (steps|minutes)|get started|workflow/i],
  [SectionKind.Audience, /for (you|teams|developers|founders|agencies|creators)|who it'?s for|a good fit|not your app|feel at home/i],
  [SectionKind.Feature, /feature|why|what you get|built for|everything you need/i]
];

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', middot: '·' };

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

export const plain = (fragment: string) => decode(fragment.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function kindOf(heading: string, lines: string[], first: boolean): SectionKind {
  if (first) {
    return SectionKind.Hero;
  }
  const text = [heading, ...lines.slice(0, 3)].join(' ');
  return KIND_BY_WORDS.find(([, words]) => words.test(heading))?.[0] ?? KIND_BY_WORDS.find(([, words]) => words.test(text))?.[0] ?? SectionKind.Feature;
}

export function sectionsOf(html: string, role: PageRole = PageRole.Home): SiteSection[] {
  const body = html.replace(NOISE, ' ');
  const drafts: { heading: string; lines: string[] }[] = [{ heading: '', lines: [] }];
  for (const m of body.matchAll(BLOCK)) {
    const text = plain(m[2]).slice(0, LINE_MAX);
    if (!text) {
      continue;
    }
    if (HEADING.test(m[1])) {
      drafts.push({ heading: text, lines: [] });
      continue;
    }
    const current = drafts[drafts.length - 1];
    if (current.lines.length < LINES_PER_SECTION && !current.lines.includes(text)) {
      current.lines.push(text);
    }
  }
  const kept = drafts.filter((d) => d.heading || d.lines.length);
  const heroAt = role === PageRole.Home ? Math.max(0, kept.findIndex((d) => d.heading)) : -1;
  return kept.slice(0, SECTIONS_PER_PAGE).map((d, i) => ({ kind: kindOf(d.heading, d.lines, i === heroAt), heading: d.heading, lines: d.lines }));
}

const LINK = /<a\b[^>]*href=["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
const WORTH: [RegExp, number][] = [
  [/pric|plans?\b/i, 6],
  [/feature|product|how|tour|why/i, 5],
  [/faq|questions|help/i, 4],
  [/customers?|stories|case|testimonials?|reviews?/i, 4],
  [/about|manifesto|story/i, 2],
  [/docs?|guide|changelog/i, 1]
];
const SKIP = /login|log-in|signin|sign-in|signup|sign-up|register|cart|checkout|privacy|terms|legal|cookie|\.(png|jpe?g|svg|pdf|zip|dmg)(\?|$)|mailto:|tel:/i;

export function linksWorthReading(html: string, base: string): string[] {
  const origin = new URL(base);
  const scored = new Map<string, number>();
  for (const m of html.matchAll(LINK)) {
    let url: URL;
    try {
      url = new URL(decode(m[1]), base);
    } catch {
      continue;
    }
    const href = `${url.origin}${url.pathname}`;
    if (url.hostname !== origin.hostname || SKIP.test(href) || url.pathname === origin.pathname || url.pathname === '/') {
      continue;
    }
    const label = `${url.pathname} ${plain(m[2])}`;
    const score = WORTH.reduce((sum, [words, points]) => sum + (words.test(label) ? points : 0), 0);
    if (score > 0) {
      scored.set(href, Math.max(scored.get(href) ?? 0, score));
    }
  }
  return [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, LINKS_KEPT).map(([url]) => url);
}

export function pageOf(url: string, html: string, role: PageRole = PageRole.Home): SitePage {
  const title = plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  return { url, title, sections: sectionsOf(html, role) };
}

const normal = (text: string) => decode(text).toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

export function quoted(pages: readonly SitePage[], source: { url: string; quote: string }): boolean {
  const quote = normal(source.quote);
  if (quote.length < 3) {
    return false;
  }
  const page = pages.find((p) => sameUrl(p.url, source.url));
  return Boolean(page && page.sections.some((s) => [s.heading, ...s.lines].some((line) => normal(line).includes(quote))));
}

function sameUrl(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.hostname.replace(/^www\./, '') === y.hostname.replace(/^www\./, '') && x.pathname.replace(/\/$/, '') === y.pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
}
