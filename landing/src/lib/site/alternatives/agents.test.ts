import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lower } from '../lower';
import { ALTERNATIVES, alternativePath } from '.';
import { ArticleKind, CalloutTone, VisualKind, type Article } from './alternative';
import { SITE_PATHS } from '../paths';

const MIN_WORDS = 1500;
const MAX_SAME_AGENT_OVERLAP = 0.4;
const MAX_IMAGE_BYTES = 200 * 1024;
const MIN_SOURCES = 5;
const FORBIDDEN_IMAGE = '87bd2d6f';
const TITLE_RANGE = [50, 60] as const;
const DESCRIPTION_RANGE = [120, 155] as const;
const MAX_SIMILARITY = 0.5;
const SHINGLE = 6;
const MAX_DASHES = 3;
const BANNED = [/\bit(?:’|')?s not\b/i, /\bisn(?:’|')t [^.]{0,40}, it(?:’|')?s\b/i, /game[- ]changer/i, /seamless/i, /revolution/i];

const SUBJECTS = ['lovable', 'framer'];
const AGENTS = ['claude-code', 'codex', 'cursor'];

const AGENT_SLUGS = SUBJECTS.flatMap((s) => AGENTS.map((a) => `${s}-alternative-for-${a}`));
const CHECKED_SLUGS = ['lovable', 'framer', ...AGENT_SLUGS];

const strip = (html: string) => html.replace(/<[^>]+>/g, ' ');

function fullText(a: Article): string {
  const r = a.rich;
  const parts = [
    a.heading,
    a.hook,
    a.lead,
    r?.verdict ?? '',
    strip(r?.snapshot ?? ''),
    ...(r?.highlights.flatMap((h) => h.paragraphs) ?? []),
    ...(r?.cost.paragraphs ?? []),
    ...(r?.steps.flatMap((s) => [s.title, s.text]) ?? []),
    r?.closing ?? '',
    ...a.pickThem.points,
    ...a.pickFeega,
    ...a.sections.flatMap((s) => [strip(s.html), s.callout?.text ?? '', s.cta?.text ?? '', s.image?.caption ?? '']),
    ...(r?.takeaways ?? []),
    ...(r?.tables ?? []).flatMap((tb) => [tb.heading, ...tb.head, ...tb.rows.flat().map(strip), tb.callout?.text ?? '']),
    ...a.mistakes.flatMap((m) => [m.q, m.a]),
    ...a.questions.flatMap((q) => [q.q, q.a])
  ];

  return parts.join(' ');
}

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}’'-]+/gu) ?? [];

const shingles = (text: string) => {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE <= w.length; i += 1) {
    out.add(w.slice(i, i + SHINGLE).join(' '));
  }
  return out;
};

const overlap = (a: Set<string>, b: Set<string>) => {
  let shared = 0;
  for (const s of a) {
    shared += b.has(s) ? 1 : 0;
  }
  return shared / Math.min(a.size, b.size);
};

const internalLinks = (a: Article) => {
  const html = [a.lead, ...a.sections.map((s) => s.html), a.rich?.snapshot ?? ''].join(' ');
  return [...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]);
};

describe('the agent and competitor pages exist', () => {
  it.each(CHECKED_SLUGS)('%s is registered', (slug) => {
    expect(ALTERNATIVES[slug]).toBeDefined();
  });

  it.each(AGENT_SLUGS)('%s has the agent kind', (slug) => {
    expect(ALTERNATIVES[slug].kind).toBe(ArticleKind.Agent);
  });
});

describe('every alternative page is a valid search result', () => {
  const all = Object.entries(ALTERNATIVES);
  const checked = CHECKED_SLUGS.map((slug) => [slug, ALTERNATIVES[slug]] as const);

  it.each(checked)('%s has a title of 50 to 60 characters', (_, a) => {
    expect(a.title.length).toBeGreaterThanOrEqual(TITLE_RANGE[0]);
    expect(a.title.length).toBeLessThanOrEqual(TITLE_RANGE[1]);
  });

  it.each(checked)('%s has a description of 120 to 155 characters', (_, a) => {
    expect(a.description.length).toBeGreaterThanOrEqual(DESCRIPTION_RANGE[0]);
    expect(a.description.length).toBeLessThanOrEqual(DESCRIPTION_RANGE[1]);
  });

  it('titles, descriptions and headings are unique', () => {
    for (const field of ['title', 'description', 'heading'] as const) {
      const values = all.map(([, a]) => a[field]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('every page is in the sitemap paths', () => {
    for (const [slug] of all) {
      expect(SITE_PATHS).toContain(alternativePath(slug));
    }
  });
});

describe('the new pages are not thin', () => {
  it.each(CHECKED_SLUGS)('%s has at least 1500 words', (slug) => {
    expect(words(fullText(ALTERNATIVES[slug])).length).toBeGreaterThanOrEqual(MIN_WORDS);
  });

  it.each(CHECKED_SLUGS)('%s shows a real diff', (slug) => {
    const diffs = ALTERNATIVES[slug].rich?.highlights.filter((h) => h.visual.kind === VisualKind.Diff) ?? [];
    expect(diffs.length).toBeGreaterThan(0);
  });

  it.each(CHECKED_SLUGS)('%s cites at least three sources', (slug) => {
    const { sources } = ALTERNATIVES[slug];
    expect(sources.length).toBeGreaterThanOrEqual(3);
    for (const s of sources) {
      expect(s.href).toMatch(/^https:\/\//);
    }
  });

  it.each(AGENT_SLUGS)('%s does not repeat its siblings', (slug) => {
    const mine = shingles(fullText(ALTERNATIVES[slug]));
    for (const other of AGENT_SLUGS.filter((s) => s !== slug)) {
      expect(overlap(mine, shingles(fullText(ALTERNATIVES[other])))).toBeLessThan(MAX_SIMILARITY);
    }
  });

  it.each(AGENT_SLUGS)('%s overlaps little with the other subject on the same agent', (slug) => {
    const [subject, agent] = slug.split('-alternative-for-');
    const otherSubject = subject === 'lovable' ? 'framer' : 'lovable';
    const twin = ALTERNATIVES[`${otherSubject}-alternative-for-${agent}`];
    expect(overlap(shingles(fullText(ALTERNATIVES[slug])), shingles(fullText(twin)))).toBeLessThanOrEqual(MAX_SAME_AGENT_OVERLAP);
  });
});

describe('the copy reads as written by a person', () => {
  it.each(CHECKED_SLUGS)('%s has no banned phrases and few dashes', (slug) => {
    const text = fullText(ALTERNATIVES[slug]);
    for (const pattern of BANNED) {
      expect(text).not.toMatch(pattern);
    }
    expect((text.match(/—/g) ?? []).length).toBeLessThanOrEqual(MAX_DASHES);
  });
});

describe('internal links', () => {
  it.each(CHECKED_SLUGS)('%s links only to pages that exist', (slug) => {
    for (const href of internalLinks(ALTERNATIVES[slug])) {
      expect(SITE_PATHS).toContain(href);
    }
  });

  it.each(AGENT_SLUGS)('%s links to its hub and to a sibling', (slug) => {
    const links = internalLinks(ALTERNATIVES[slug]);
    const subject = slug.split('-alternative-')[0];
    expect(links).toContain(alternativePath(subject));
    expect(links.some((l) => l !== alternativePath(subject) && l.startsWith('/alternatives/'))).toBe(true);
  });

  it.each(['lovable', 'framer'])('hub %s links to all three agent pages', (subject) => {
    const links = internalLinks(ALTERNATIVES[subject]);
    for (const agent of AGENTS) {
      expect(links).toContain(alternativePath(`${subject}-alternative-for-${agent}`));
    }
  });
});

const callouts = (a: Article) => [...a.sections.flatMap((s) => (s.callout ? [s.callout] : [])), ...(a.rich?.tables ?? []).flatMap((tb) => (tb.callout ? [tb.callout] : []))];
const ctas = (a: Article) => a.sections.flatMap((s) => (s.cta ? [s.cta] : []));
const shots = (a: Article) => [...(a.rich?.hero ? [a.rich.hero] : []), ...a.sections.flatMap((s) => (s.image ? [s.image] : []))];
const citedHtml = (a: Article) => [a.lead, a.rich?.snapshot ?? '', ...a.sections.map((s) => s.html), ...(a.rich?.tables ?? []).flatMap((tb) => tb.rows.flat())].join(' ');
const NAMES = ['Lovable', 'Framer', 'Feega', 'Claude Code', 'Codex', 'OpenAI', 'Cursor', 'GitHub', 'VS Code', 'Tailwind', 'SvelteKit', 'Next.js', 'Grok Build'];

describe('the pages carry the article blocks', () => {
  it.each(CHECKED_SLUGS)('%s has three to five takeaways', (slug) => {
    const n = ALTERNATIVES[slug].rich?.takeaways?.length ?? 0;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
  });

  it.each(CHECKED_SLUGS)('%s has a comparison table with a header and at least five rows', (slug) => {
    const tables = ALTERNATIVES[slug].rich?.tables ?? [];
    expect(tables.length).toBeGreaterThanOrEqual(1);
    expect(tables[0].rows.length).toBeGreaterThanOrEqual(5);
    for (const row of tables[0].rows) {
      expect(row.length).toBe(tables[0].head.length);
    }
  });

  it.each(CHECKED_SLUGS)('%s has at least two callouts of different tones', (slug) => {
    const tones = new Set(callouts(ALTERNATIVES[slug]).map((c) => c.tone));
    expect(tones.size).toBeGreaterThanOrEqual(2);
    expect([...tones].every((t) => Object.values(CalloutTone).includes(t))).toBe(true);
  });

  it.each(CHECKED_SLUGS)('%s has a download call to action and a docs one', (slug) => {
    const hrefs = ctas(ALTERNATIVES[slug]).map((c) => c.href);
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    expect(hrefs).toContain('/download');
    expect(hrefs.some((h) => h.startsWith('https://docs.feega.app'))).toBe(true);
  });

  it.each(CHECKED_SLUGS)('%s cites five sources and links them inline', (slug) => {
    const a = ALTERNATIVES[slug];
    expect(a.sources.length).toBeGreaterThanOrEqual(MIN_SOURCES);
    const html = citedHtml(a);
    const inline = a.sources.filter((s) => html.includes(`href="${s.href}"`));
    expect(inline.length).toBeGreaterThanOrEqual(MIN_SOURCES);
  });

  it.each(CHECKED_SLUGS)('%s has real internal links to the download and pricing pages', (slug) => {
    const links = internalLinks(ALTERNATIVES[slug]);
    expect(links).toContain('/download');
    expect(links).toContain('/pricing');
    expect(links.some((l) => l.startsWith('/alternatives/'))).toBe(true);
  });
});

describe('the images', () => {
  it.each(CHECKED_SLUGS)('%s has captioned, sized, small webp images with alt text', (slug) => {
    const list = shots(ALTERNATIVES[slug]);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const s of list) {
      const file = new URL(`../../../../static${s.src}`, import.meta.url);
      expect(s.src).toMatch(/\.webp$/);
      expect(s.src).not.toContain(FORBIDDEN_IMAGE);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
      expect(s.alt.length).toBeGreaterThan(20);
      expect(s.caption.length).toBeGreaterThan(10);
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
    }
  });

  it.each(CHECKED_SLUGS)('%s shows no composed agent panel', (slug) => {
    for (const s of shots(ALTERNATIVES[slug])) {
      expect(s.src).not.toMatch(/feega-(codex|cursor|claude-code)\.webp$/);
      expect(`${s.alt} ${s.caption}`.toLowerCase()).not.toMatch(/illustrative|composite/);
    }
  });
});

describe('proper names keep their capitals in headings', () => {
  it.each(CHECKED_SLUGS)('%s', (slug) => {
    const a = ALTERNATIVES[slug];
    const headings = [a.heading, ...a.sections.map((s) => s.heading), ...(a.rich?.tables ?? []).map((tb) => tb.heading), ...(a.rich?.highlights ?? []).map((h) => h.heading), a.rich?.stepsHeading ?? '', a.rich?.snapshotHeading ?? '', a.rich?.cost.heading ?? ''];
    for (const heading of headings) {
      for (const name of NAMES.filter((n) => heading.includes(n))) {
        expect(lower(heading)).toContain(name);
      }
    }
  });
});
