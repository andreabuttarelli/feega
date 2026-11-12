import { describe, expect, it } from 'vitest';
import { LANDING_PAGES } from './landing';
import { UPSCALER } from './landing/upscaler';
import { CODEBASE } from './codebase';
import { LEGAL_DOCS } from './legal';
import { COMPARE_INDEX, COMPARISONS } from './compare';
import { GUIDES, GUIDES_INDEX } from './guides';
import { competitorFaq } from './compare/faq';
import { AI_CRAWLERS } from './crawlers';
import { GET as robots } from '../../routes/robots.txt/+server';
import { FAQ } from './home';
import { HOME_META } from './seo';
import { breadcrumbJsonLd, faqJsonLd, HOME_JSON_LD } from './structured-data';
import { llmsFullTxt, llmsTxt } from './llms';
import { SITE_PATHS } from './paths';

const MAX_TITLE = 60;
const MAX_DESCRIPTION = 160;

const metas = [
  ['home', HOME_META],
  ['upscaler', UPSCALER],
  ['codebase', CODEBASE],
  ...Object.entries(LANDING_PAGES),
  ...Object.entries(LEGAL_DOCS),
  ['compare', COMPARE_INDEX],
  ['guides', GUIDES_INDEX],
  ...Object.entries(GUIDES),
  ...Object.entries(COMPARISONS)
] as const;

describe('search metadata', () => {
  it('the home page names Feega capitalised, as all copy does', () => {
    expect(HOME_META.title).toMatch(/^Feega\b/);
    expect(HOME_META.description).toMatch(/^Feega\b/);
  });

  it.each(metas)('%s fits the title and description limits', (_, m) => {
    expect(m.title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(m.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it('never repeats a title or a description', () => {
    expect(new Set(metas.map(([, m]) => m.title)).size).toBe(metas.length);
    expect(new Set(metas.map(([, m]) => m.description)).size).toBe(metas.length);
  });
});

describe('structured data', () => {
  const types = (html: string) => [...html.matchAll(/"@type":"(\w+)"/g)].map((m) => m[1]);

  it('the home page declares organization, application and the FAQ', () => {
    expect(types(HOME_JSON_LD)).toEqual(expect.arrayContaining(['Organization', 'SoftwareApplication', 'FAQPage']));
  });

  it('the FAQ markup carries every visible question, with plain-text answers', () => {
    const data = JSON.parse(faqJsonLd(FAQ).replace(/^<script[^>]*>|<\/script>$/g, ''));
    expect(data.mainEntity.map((q: { name: string }) => q.name)).toEqual(FAQ.map((f) => f.q));
    expect(JSON.stringify(data)).not.toMatch(/<a |<\/a>/);
  });

  it('answers what people ask assistants', () => {
    const q = FAQ.map((f) => f.q).join('\n');
    for (const topic of [/open source/i, /locally/i, /pricing/i, /Figma/]) {
      expect(q).toMatch(topic);
    }
  });

  it('a breadcrumb ends at the page itself', () => {
    const data = JSON.parse(breadcrumbJsonLd('Changelog', '/changelog').replace(/^<script[^>]*>|<\/script>$/g, ''));
    expect(data.itemListElement.map((i: { item: string }) => i.item)).toEqual(['https://feega.app/', 'https://feega.app/changelog']);
  });
});

describe('llms.txt', () => {
  it('lists every public page', () => {
    for (const path of SITE_PATHS.filter((p) => p !== '/')) {
      expect(llmsTxt()).toContain(`https://feega.app${path}`);
    }
  });

  it('the full file repeats the FAQ answers', () => {
    expect(llmsFullTxt()).toContain(FAQ[0].q);
    expect(llmsFullTxt()).not.toMatch(/<a |<\/a>/);
  });
});

const wordCount = (text: string) => text.trim().split(/\s+/).length;

describe('answer-first pages', () => {
  it.each(Object.entries(GUIDES))('%s answers in 40 to 60 words', (_, g) => {
    expect(wordCount(g.answer)).toBeGreaterThanOrEqual(40);
    expect(wordCount(g.answer)).toBeLessThanOrEqual(60);
  });

  it.each(Object.entries(GUIDES))('%s has a FAQ', (_, g) => {
    expect(g.faq.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(COMPARISONS))('%s opens with a 40 to 70 word answer and a FAQ', (_, c) => {
    expect(wordCount(c.intro)).toBeGreaterThanOrEqual(40);
    expect(wordCount(c.intro)).toBeLessThanOrEqual(70);
    expect(competitorFaq(c).length).toBeGreaterThan(0);
  });

  it('llms-full lists only MCP tools the server defines', () => {
    expect(llmsFullTxt()).toContain('claude mcp add --transport http feega');
  });
});

describe('robots.txt', () => {
  it('allows the AI crawlers by name', async () => {
    const body = await robots().text();
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
      expect(AI_CRAWLERS).toContain(bot);
      expect(body).toContain(`User-agent: ${bot}\nAllow: /`);
    }
  });
});

describe('organization markup', () => {
  it('links the organization to its profiles', () => {
    expect(HOME_JSON_LD).toContain('"sameAs":["https://github.com/andreabuttarelli/feega"');
  });
});
