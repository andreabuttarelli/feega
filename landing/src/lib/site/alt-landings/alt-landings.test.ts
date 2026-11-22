import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { ALTERNATIVES, alternativePath } from '../alternatives';
import { llmsFullTxt, llmsTxt, trailOf } from '../llms';
import { SITE_PATHS } from '../paths';
import { sitemapXml } from '../sitemap';
import { altLandingJsonLd } from '../structured-data';
import { SITE_URL } from '../links';
import { lower } from '../lower';
import AltLanding from './AltLanding.svelte';
import { ALT_LANDINGS, ALT_LANDING_PATHS, altLandingPath, landingFor, wordsOf } from './index';
import { Agent, Tool } from './variant';

const MAX_META_TITLE = 60;
const MAX_META_DESCRIPTION = 155;
const MIN_UNIQUE_WORDS = 250;
const FAQ_RANGE = { min: 4, max: 6 };
const MIN_STRIP_ROWS = 4;

const unique = (values: readonly string[]) => new Set(values).size === values.length;

describe('variant table', () => {
  it('holds the six agent and tool pairs', () => {
    const pairs = ALT_LANDINGS.map((v) => `${v.tool}/${v.agent}`).sort();
    const expected = [Tool.Lovable, Tool.Framer].flatMap((t) => [Agent.ClaudeCode, Agent.Codex, Agent.Cursor].map((a) => `${t}/${a}`)).sort();
    expect(pairs).toEqual(expected);
  });

  it('never repeats a slug, title, headline, subhead or meta', () => {
    expect(unique(ALT_LANDINGS.map((v) => v.slug))).toBe(true);
    expect(unique(ALT_LANDINGS.map((v) => v.title))).toBe(true);
    expect(unique(ALT_LANDINGS.map((v) => v.h1))).toBe(true);
    expect(unique(ALT_LANDINGS.map((v) => v.subhead))).toBe(true);
    expect(unique(ALT_LANDINGS.map((v) => v.meta.title))).toBe(true);
    expect(unique(ALT_LANDINGS.map((v) => v.meta.description))).toBe(true);
  });

  it.each(ALT_LANDINGS.map((v) => [v.slug, v] as const))('%s fits the meta limits', (_, v) => {
    expect(v.meta.title.length).toBeLessThanOrEqual(MAX_META_TITLE);
    expect(v.meta.description.length).toBeLessThanOrEqual(MAX_META_DESCRIPTION);
  });

  it.each(ALT_LANDINGS.map((v) => [v.slug, v] as const))('%s names its tool and agent in the title', (_, v) => {
    expect(v.title).toContain(v.tool);
    expect(v.title).toContain(v.agent);
    expect(v.slug).toBe(`${v.tool.toLowerCase()}-alternative-for-${v.agent.toLowerCase().replace(' ', '-')}`);
  });

  it.each(ALT_LANDINGS.map((v) => [v.slug, v] as const))('%s has a FAQ of four to six and a full strip', (_, v) => {
    expect(v.faq.length).toBeGreaterThanOrEqual(FAQ_RANGE.min);
    expect(v.faq.length).toBeLessThanOrEqual(FAQ_RANGE.max);
    expect(v.strip.length).toBeGreaterThanOrEqual(MIN_STRIP_ROWS);
  });

  it.each(ALT_LANDINGS.map((v) => [v.slug, v] as const))('%s has at least 250 words of its own', (_, v) => {
    expect(wordsOf(v)).toBeGreaterThanOrEqual(MIN_UNIQUE_WORDS);
  });

  it('dates every price it quotes', () => {
    for (const v of ALT_LANDINGS.filter((x) => x.strip.some((r) => r.tool.includes('$')))) {
      expect(v.strip.some((r) => r.tool.includes('checked 22 November 2026'))).toBe(true);
    }
  });
});

describe('cross links', () => {
  it.each(ALT_LANDINGS.map((v) => [v.slug] as const))('%s pairs with the article of the same slug', (slug) => {
    expect(Object.hasOwn(ALTERNATIVES, slug)).toBe(true);
    expect(landingFor(slug)?.slug).toBe(slug);
  });

  it('knows no landing for the other articles', () => {
    expect(landingFor('lovable')).toBeUndefined();
  });
});

describe('rendering', () => {
  it.each(ALT_LANDINGS.map((v) => [v.slug, v] as const))('%s renders its copy and the way to the full comparison', (_, v) => {
    const { body } = render(AltLanding, { props: { variant: v } });
    expect(body.toLowerCase()).toContain(v.differentiators[0].heading.toLowerCase());
    expect(body).toContain(v.strip[0].feega);
    expect(body).toContain(`href="${alternativePath(v.slug)}"`);
    expect(body).toContain(lower(v.faq[0].q));
  });

  it('writes the page, application and FAQ structured data', () => {
    const [v] = ALT_LANDINGS;
    const json = altLandingJsonLd({ name: v.title, description: v.meta.description, path: altLandingPath(v.slug), faq: v.faq });
    for (const type of ['"WebPage"', '"SoftwareApplication"', '"FAQPage"']) {
      expect(json).toContain(type);
    }
    expect(json).toContain(`${SITE_URL}${altLandingPath(v.slug)}`);
  });
});

describe('discovery', () => {
  it('lists every landing in the sitemap with its check date', () => {
    for (const path of ALT_LANDING_PATHS) {
      expect(SITE_PATHS).toContain(path);
      expect(sitemapXml()).toContain(`<loc>${SITE_URL}${path}</loc><lastmod>2026-11-22</lastmod>`);
    }
  });

  it('adds an Alternatives (quick) section to llms.txt with every landing', () => {
    const text = llmsTxt();
    expect(text).toContain('## Alternatives (quick)');
    for (const v of ALT_LANDINGS) {
      expect(text).toContain(`[${v.title}](${SITE_URL}${altLandingPath(v.slug)})`);
    }
  });

  it('lists each landing once in llms-full.txt', () => {
    const text = llmsFullTxt();
    for (const path of ALT_LANDING_PATHS) {
      expect(text.split(`${SITE_URL}${path})`)).toHaveLength(2);
    }
  });

  it('gives each landing a breadcrumb', () => {
    for (const v of ALT_LANDINGS) {
      expect(trailOf(altLandingPath(v.slug)).map((c) => c.name)).toEqual([v.title]);
    }
  });
});
