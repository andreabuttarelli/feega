import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODEBASE } from './codebase';
import { LEGAL_DOCS } from './legal';
import { AI_CRAWLERS } from './crawlers';
import { GET as robots } from '../../routes/robots.txt/+server';
import { FAQ, HERO_HEADLINE } from './home';
import { HOME_META, OG } from './seo';
import { breadcrumbJsonLd, faqJsonLd, HOME_JSON_LD } from './structured-data';
import { llmsFullTxt, llmsTxt, trailOf } from './llms';
import { SITE_PATHS } from './paths';

const MAX_TITLE = 60;
const MAX_DESCRIPTION = 160;

const metas = [
  ['home', HOME_META],
  ['codebase', CODEBASE],
  ...Object.entries(LEGAL_DOCS)
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

  it('the home page names the site and gives the organization a logo, for sitelinks', () => {
    expect(types(HOME_JSON_LD)).toContain('WebSite');
    expect(HOME_JSON_LD).toContain('"alternateName":["feega.app","Feega editor"]');
    expect(HOME_JSON_LD).toContain('"logo":"https://www.feega.app/site/logo.png"');
  });

  it('the application is described as today’s product', () => {
    expect(HOME_JSON_LD).not.toContain('Feega Inspect is');
    expect(HOME_JSON_LD).toContain('npx feega');
  });

  it('the FAQ markup carries every visible question, with plain-text answers', () => {
    const data = JSON.parse(faqJsonLd(FAQ).replace(/^<script[^>]*>|<\/script>$/g, ''));
    expect(data.mainEntity.map((q: { name: string }) => q.name)).toEqual(FAQ.map((f) => f.q));
    expect(JSON.stringify(data)).not.toMatch(/<a |<\/a>/);
  });

  it('answers what people ask assistants', () => {
    const q = FAQ.map((f) => f.q).join('\n');
    for (const topic of [/free/i, /agent/i, /editors/i, /cloud/i]) {
      expect(q).toMatch(topic);
    }
  });

  it('a breadcrumb ends at the page itself', () => {
    const data = JSON.parse(breadcrumbJsonLd(trailOf('/changelog')).replace(/^<script[^>]*>|<\/script>$/g, ''));
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

describe('llms surfaces', () => {
  it('states editors, terminal, desktop and Cloud as coming soon, without a download link', () => {
    for (const text of [llmsTxt(), llmsFullTxt()]) {
      expect(text).toContain('## Where it runs');
      expect(text).toMatch(/Cursor, Windsurf and VSCodium/);
      expect(text).toContain('`npx feega`');
      expect(text).toMatch(/Desktop app: coming soon/);
      expect(text).toMatch(/Feega Cloud: coming soon/);
      expect(text).not.toMatch(/\.dmg|desktop-latest/);
    }
  });
});

describe('llms-full', () => {
  it('llms-full says the extension is not published yet, without fake install links', () => {
    expect(llmsFullTxt()).not.toContain('vscode:extension');
  });
});

describe('robots.txt', () => {
  it('allows the AI crawlers, search bots and user agents by name', async () => {
    const body = await robots().text();
    for (const bot of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended']) {
      expect(AI_CRAWLERS).toContain(bot);
      expect(body).toContain(`User-agent: ${bot}\nAllow: /`);
    }
  });
});

describe('canonical host', () => {
  it('robots.txt points at the www sitemap', async () => {
    expect(await robots().text()).toContain('Sitemap: https://www.feega.app/sitemap.xml');
  });

  it('no generated file names the bare domain', () => {
    expect(llmsTxt() + llmsFullTxt() + HOME_JSON_LD).not.toMatch(/https:\/\/feega\.app/);
  });

  it('llms.txt describes the extension, not the old video product', () => {
    expect(llmsTxt()).toMatch(/VS Code extension/);
    expect(llmsTxt() + llmsFullTxt()).not.toMatch(/video generator|upscal|claymation/i);
  });
});

describe('organization markup', () => {
  it('links the organization to its profiles', () => {
    expect(HOME_JSON_LD).toContain('"sameAs":["https://github.com/andreabuttarelli/feega"');
  });
});

const STATIC_DIR = resolve(import.meta.dirname, '../../../static');
const LAYOUT = readFileSync(resolve(import.meta.dirname, '../../routes/+layout.svelte'), 'utf8');
const KB = 1024;
const PNG_WIDTH_AT = 16;
const TKHD_WIDTH_AT = 80;
const FIXED_POINT = 65536;

const staticFile = (url: string) => resolve(STATIC_DIR, new URL(url).pathname.slice(1));

function pngSize(file: string) {
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(PNG_WIDTH_AT), height: bytes.readUInt32BE(PNG_WIDTH_AT + 4) };
}

function mp4Size(file: string) {
  const bytes = readFileSync(file);
  const at = bytes.indexOf('tkhd') + TKHD_WIDTH_AT;
  return { width: bytes.readUInt32BE(at) / FIXED_POINT, height: bytes.readUInt32BE(at + 4) / FIXED_POINT };
}

describe('social preview', () => {
  it('the image is a PNG of the declared size, small enough for every crawler', () => {
    expect(OG.image.type).toBe('image/png');
    expect(pngSize(staticFile(OG.image.url))).toEqual({ width: OG.image.width, height: OG.image.height });
    expect(statSync(staticFile(OG.image.url)).size).toBeLessThan(300 * KB);
  });

  it('the image url carries the content hash of og.png, so platforms refetch on change', () => {
    const hash = createHash('sha256').update(readFileSync(staticFile(OG.image.url))).digest('hex').slice(0, 8);
    expect(new URL(OG.image.url).searchParams.get('v')).toBe(hash);
  });

  it('the video is an MP4 of the declared size, under 4 MB', () => {
    expect(OG.video.type).toBe('video/mp4');
    expect(mp4Size(staticFile(OG.video.url))).toEqual({ width: OG.video.width, height: OG.video.height });
    expect(statSync(staticFile(OG.video.url)).size).toBeLessThan(4 * KB * KB);
  });

  it('every page inherits absolute image and video urls from the layout', () => {
    expect(OG.image.url).toMatch(/^https:\/\/www\.feega\.app\//);
    expect(OG.video.url).toMatch(/^https:\/\/www\.feega\.app\//);
    for (const tag of ['og:image', 'og:image:width', 'og:image:height', 'og:image:type', 'og:image:alt', 'og:video', 'og:video:secure_url', 'og:video:type', 'og:video:width', 'og:video:height', 'twitter:image', 'twitter:image:alt']) {
      expect(LAYOUT).toContain(`"${tag}"`);
    }
    expect(LAYOUT).toContain('content="summary_large_image"');
  });

  it('every page names the maker for buildinpublic.com verification', () => {
    expect(LAYOUT).toContain('<meta name="twitter:creator" content="@andreabttrll" />');
  });

  it('the alt text describes the image, not a code diff it does not show', () => {
    expect(OG.image.alt).not.toMatch(/diff|64px|88px/i);
    expect(OG.image.alt).toMatch(/logo/i);
    expect(OG.image.alt).toMatch(/open source/i);
    expect(OG.image.alt).toMatch(/screenshot/i);
  });

  it('the alt text says what Feega is, in the hero headline', () => {
    expect(OG.image.alt).toMatch(/^Feega/);
    expect(OG.image.alt).toContain(HERO_HEADLINE);
  });
});
