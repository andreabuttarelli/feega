import type { OutlineBlock, OutlineBox, PageOutline } from './page-outline';

export type PageSection = { name: string; top: number; bottom: number };

export enum SectionName {
  Nav = 'Nav',
  Hero = 'Hero',
  Logos = 'Logos',
  Features = 'Features',
  Testimonials = 'Testimonials',
  Pricing = 'Pricing',
  Faq = 'FAQ',
  Stats = 'Stats',
  News = 'News',
  Cta = 'CTA',
  Footer = 'Footer'
}

const FALLBACK = 'Section';
const OVERLAP_PX = 8;
const TALL_PX = 1200;
const LARGE_GAP_PX = 160;
const MIN_SECTION_PX = 48;
const NAV_ZONE_PX = 200;
const NAV_MAX_PX = 200;
const HERO_ZONE_PX = 1400;
const LOGO_STRIP_PX = 240;
const LOGO_PICTURES = 5;
const CTA_MAX_PX = 720;
const FAQ_TOGGLES = 3;
const QUOTES = 2;

const LANDMARK_TAGS = new Set(['header', 'nav', 'footer', 'section', 'article', 'aside', 'form']);
const LANDMARK_ROLES = new Set(['banner', 'navigation', 'contentinfo', 'region', 'complementary', 'search', 'form']);
const MAIN_TAGS = new Set(['main', 'body']);
const NAV_TAGS = new Set(['header', 'nav']);
const NAV_ROLES = new Set(['banner', 'navigation']);

type Block = { from: OutlineBlock; box: OutlineBox; background?: string };

type Facts = { tag: string; role: string; words: string; heading: string; h1: boolean; pinned: boolean; pictures: number; quotes: number; toggles: number; top: number; height: number };

const navLike = (f: Facts) => NAV_TAGS.has(f.tag) || NAV_ROLES.has(f.role) || f.pinned || /\b(nav|navbar|navigation|menu|header|topbar)\b/.test(f.words);
const text = (f: Facts) => `${f.words} ${f.heading}`;

const SECTION_NAMES: { name: SectionName; when: (f: Facts) => boolean }[] = [
  { name: SectionName.Nav, when: (f) => navLike(f) && f.top < NAV_ZONE_PX && f.height <= NAV_MAX_PX },
  { name: SectionName.Footer, when: (f) => f.tag === 'footer' || f.role === 'contentinfo' || /\bfooter\b/.test(f.words) },
  { name: SectionName.Hero, when: (f) => (f.h1 || /\bhero\b/.test(f.words)) && f.top < HERO_ZONE_PX },
  { name: SectionName.Faq, when: (f) => /\bfaqs?\b|frequently asked|questions/.test(text(f)) || f.toggles >= FAQ_TOGGLES },
  { name: SectionName.Pricing, when: (f) => /\bpricing\b|\bplans\b|\bprices?\b/.test(text(f)) },
  { name: SectionName.Testimonials, when: (f) => /testimonial|\breviews\b|what .* say|loved by|\bcustomers?\b|case stud/.test(text(f)) || f.quotes >= QUOTES },
  { name: SectionName.Logos, when: (f) => /\blogos?\b|trusted by|\bbrands\b|partners|clients/.test(text(f)) || (f.pictures >= LOGO_PICTURES && f.height <= LOGO_STRIP_PX && !f.heading) },
  { name: SectionName.Stats, when: (f) => /\bstats?\b|statistic|metrics/.test(text(f)) },
  { name: SectionName.News, when: (f) => /\bnews\b|\bblog\b|changelog|\bupdates\b|\bevents?\b|recently shipped|\blatest\b/.test(text(f)) },
  { name: SectionName.Cta, when: (f) => /get started|start (building|for free|now|today)|try .*free|sign up|contact sales|ready to|available today|book a demo|\bjoin\b/.test(f.heading) && f.height <= CTA_MAX_PX },
  { name: SectionName.Features, when: (f) => /feature|benefit|capabilit|solution|how it works/.test(text(f)) }
];

const bottomOf = (b: OutlineBox) => b.y + b.height;

function factsOf(block: Block): Facts {
  const b = block.from;
  const hints = [b.hint, b.label, ...(b.children ?? []).map((c) => c.hint)].filter(Boolean).join(' ');
  return {
    tag: b.tag,
    role: b.role ?? '',
    words: hints.toLowerCase(),
    heading: (b.heading ?? '').toLowerCase(),
    h1: Boolean(b.h1),
    pinned: Boolean(b.pinned),
    pictures: b.pictures ?? 0,
    quotes: b.quotes ?? 0,
    toggles: b.toggles ?? 0,
    top: block.box.y,
    height: block.box.height
  };
}

const nameOf = (block: Block) => SECTION_NAMES.find((rule) => rule.when(factsOf(block)))?.name ?? null;

const landmark = (b: OutlineBlock) => LANDMARK_TAGS.has(b.tag) || LANDMARK_ROLES.has(b.role ?? '');

const contained = (inner: OutlineBox, outer: OutlineBox) => inner.y >= outer.y - OVERLAP_PX && bottomOf(inner) <= bottomOf(outer) + OVERLAP_PX;

const head = (b: OutlineBlock) => (NAV_TAGS.has(b.tag) || NAV_ROLES.has(b.role ?? '') || Boolean(b.pinned)) && b.box.y < NAV_ZONE_PX && b.box.height <= NAV_MAX_PX;

function stackOf(kids: OutlineBlock[]): OutlineBlock[] | null {
  const sorted = [...kids].sort((a, b) => a.box.y - b.box.y || Number(head(b)) - Number(head(a)) || b.box.height - a.box.height);
  const shown = sorted.filter((k) => head(k) || !sorted.some((o) => o !== k && o.box.height > k.box.height && contained(k.box, o.box)));
  for (let i = 1; i < shown.length; i++) {
    const [before, now] = [shown[i - 1], shown[i]];
    if (now.box.y < bottomOf(before.box) - OVERLAP_PX && !head(before)) {
      return null;
    }
  }
  return shown;
}

function blocksOf(node: OutlineBlock, background: string | undefined, spine: boolean): Block[] {
  const ground = node.background ?? background;
  const own: Block = { from: node, box: node.box, background: ground };
  const opens = MAIN_TAGS.has(node.tag) || node.role === 'main' || (!landmark(node) && (spine || node.box.height > TALL_PX || node.children?.length === 1));
  const kids = opens ? stackOf(node.children ?? []) : null;
  if (!kids?.length) {
    return [own];
  }
  if (kids.length === 1 && !head(kids[0])) {
    const only = blocksOf(kids[0], ground, spine);
    return only.length === 1 ? [{ ...only[0], box: node.box }] : only;
  }
  return kids.flatMap((k) => blocksOf(k, ground, false));
}

function mergedRuns(blocks: Block[]): Block[] {
  const runs: Block[] = [];
  for (const block of blocks) {
    const last = runs.at(-1);
    const gap = last ? block.box.y - bottomOf(last.box) : Infinity;
    const tiny = block.box.height < MIN_SECTION_PX && !nameOf(block);
    const continues = !landmark(block.from) && !landmark(last?.from ?? block.from) && !block.from.heading && !nameOf(block) && gap < LARGE_GAP_PX && block.background === last?.background;
    if (last && (tiny || continues)) {
      runs[runs.length - 1] = { ...last, box: { ...last.box, height: Math.max(bottomOf(last.box), bottomOf(block.box)) - last.box.y } };
      continue;
    }
    runs.push(block);
  }
  return runs;
}

function uniquely(names: string[]): string[] {
  const uses = new Map<string, number>();
  return names.map((name) => {
    const n = (uses.get(name) ?? 0) + 1;
    uses.set(name, n);
    return n === 1 ? name : `${name} ${n}`;
  });
}

export function sectionsOf(outline: PageOutline): PageSection[] {
  const height = outline.height;
  const blocks = mergedRuns(blocksOf(outline.root, undefined, true).filter((b) => b.box.y < height).sort((a, b) => a.box.y - b.box.y));
  const tops = blocks.map((b, i) => (i === 0 ? 0 : Math.max(blocks[i - 1].box.y, Math.min(bottomOf(blocks[i - 1].box), b.box.y))));
  const names = uniquely(blocks.map((b, i) => nameOf(b) ?? `${FALLBACK} ${i + 1}`));
  return blocks.map((_, i) => ({ name: names[i], top: tops[i], bottom: tops[i + 1] ?? height }));
}
