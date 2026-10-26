import { describe, expect, it } from 'vitest';
import { LANDING_PAGES } from './landing';
import { UPSCALER } from './landing/upscaler';
import { LEGAL_DOCS } from './legal';
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
  ...Object.entries(LANDING_PAGES),
  ...Object.entries(LEGAL_DOCS)
] as const;

describe('search metadata', () => {
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
    for (const topic of [/open source/i, /locally/i, /cost/i, /Figma/, /Jitter/, /Flora/]) {
      expect(q).toMatch(topic);
    }
  });

  it('a breadcrumb ends at the page itself', () => {
    const data = JSON.parse(breadcrumbJsonLd('Changelog', '/changelog').replace(/^<script[^>]*>|<\/script>$/g, ''));
    expect(data.itemListElement.map((i: { item: string }) => i.item)).toEqual(['https://www.feega.app/', 'https://www.feega.app/changelog']);
  });
});

describe('llms.txt', () => {
  it('lists every public page', () => {
    for (const path of SITE_PATHS.filter((p) => p !== '/')) {
      expect(llmsTxt()).toContain(`https://www.feega.app${path}`);
    }
  });

  it('the full file repeats the FAQ answers', () => {
    expect(llmsFullTxt()).toContain(FAQ[0].q);
    expect(llmsFullTxt()).not.toMatch(/<a |<\/a>/);
  });
});
