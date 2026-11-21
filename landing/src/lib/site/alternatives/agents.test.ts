import { describe, expect, it } from 'vitest';
import { ALTERNATIVES, alternativePath } from '.';
import { ArticleKind, VisualKind, type Article } from './alternative';
import { SITE_PATHS } from '../paths';

const MIN_WORDS = 1000;
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
    ...a.sections.map((s) => strip(s.html)),
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
  it.each(CHECKED_SLUGS)('%s has at least 1000 words', (slug) => {
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
