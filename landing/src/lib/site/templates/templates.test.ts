import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_TITLES, llmsFullTxt, llmsTxt } from '../llms';
import { SITE_PATHS } from '../paths';
import { sitemapXml } from '../sitemap';
import { wordsIn } from '../topics/topic';
import { CATEGORY_COPY, FRAMEWORK_COPY, HUB_COPY } from './copy';
import { factsOf, relatedTo, tokensUsed } from './guide';
import { TEMPLATE_PATHS } from './index';
import { collectionJsonLd, templateJsonLd } from './jsonld';
import { PREVIEWABLE, TEMPLATES, templateById } from './library';
import { HUB_META, MAX_DESCRIPTION, MAX_TITLE, categoryMeta, frameworkMeta, templateMeta } from './meta';
import { CATEGORY_SLUGS, HUB_FRAMEWORKS, HUB_SLUGS, VideoFormat, frameworkPath, proPosterPath, proVideoPath, shotPath, templatePath } from './paths';
import { previewDocument } from './preview';
import { TOKENS_CSS, codeOf, previewParts } from './sources';
import { Category, Framework, Theme, Tier } from './template';

const STATIC = resolve(import.meta.dirname, '../../../../static');
const LIBRARY = resolve(import.meta.dirname, '../../../../../packages/library');
const LIBRARY_SIZE = ['items', 'pro'].flatMap((dir) => readdirSync(resolve(LIBRARY, dir))).length;
const PRO_ID = 'parallax-gallery';
const CATEGORY_WORDS = { min: 150, max: 300 };
const FRAMEWORK_WORDS = { min: 400, max: 700 };

const words = (paragraphs: readonly string[]) => wordsIn(paragraphs.join(' '));

describe('the template library on the landing', () => {
  it('reads every item of the library', () => {
    expect(TEMPLATES).toHaveLength(LIBRARY_SIZE);
  });

  it('keeps item ids apart from hub slugs, so two routes never claim one url', () => {
    expect(TEMPLATES.filter((t) => HUB_SLUGS.includes(t.id))).toEqual([]);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s has a unique title and description inside the limits', (_, t) => {
    const meta = templateMeta(t);
    expect(meta.title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(meta.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it('never repeats a title or a description', () => {
    const metas = TEMPLATES.map(templateMeta);
    expect(new Set(metas.map((m) => m.title)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.description)).size).toBe(metas.length);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s has a thumbnail in both themes', (id) => {
    for (const theme of Object.values(Theme)) {
      expect(existsSync(resolve(STATIC, shotPath(id, theme).slice(1)))).toBe(true);
    }
  });

  it('every free item carries code in all five frameworks, and no pro item carries any', async () => {
    for (const template of TEMPLATES) {
      const code = await codeOf(template);
      for (const framework of Object.values(Framework)) {
        expect(code[framework].length > 0).toBe(template.tier === Tier.Free);
      }
    }
  });
});

describe('hub pages', () => {
  it.each(Object.keys(CATEGORY_SLUGS) as Category[])('the %s hub has 150 to 300 words and fits the meta limits', (category) => {
    const { lead, paragraphs } = CATEGORY_COPY[category];
    expect(words([lead, ...paragraphs])).toBeGreaterThanOrEqual(CATEGORY_WORDS.min);
    expect(words([lead, ...paragraphs])).toBeLessThanOrEqual(CATEGORY_WORDS.max);
    expect(categoryMeta(category).title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(categoryMeta(category).description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it.each(HUB_FRAMEWORKS)('the %s hub has 400 to 700 words and fits the meta limits', (framework) => {
    const copy = FRAMEWORK_COPY[framework];
    const count = words([copy.lead, ...copy.sections.flatMap((s) => [s.heading, ...s.paragraphs])]);
    expect(count).toBeGreaterThanOrEqual(FRAMEWORK_WORDS.min);
    expect(count).toBeLessThanOrEqual(FRAMEWORK_WORDS.max);
    expect(frameworkMeta(framework).title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(frameworkMeta(framework).description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it('every hub title and description is unique across the section', () => {
    const metas = [HUB_META, ...(Object.keys(CATEGORY_SLUGS) as Category[]).map(categoryMeta), ...HUB_FRAMEWORKS.map(frameworkMeta), ...TEMPLATES.map(templateMeta)];
    expect(new Set(metas.map((m) => m.title)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.description)).size).toBe(metas.length);
  });

  it('the SvelteKit hub names the three Svelte libraries it compares against and says to check them', () => {
    const text = FRAMEWORK_COPY[Framework.Svelte].sections.flatMap((s) => s.paragraphs).join(' ');
    for (const name of ['shadcn-svelte', 'Skeleton', 'Flowbite Svelte']) {
      expect(text).toContain(name);
    }
    expect(text).toMatch(/check each project/);
  });

  it('the home of the library answers the questions people ask', () => {
    expect(HUB_COPY.faq.map((f) => f.q).join(' ')).toMatch(/free/i);
  });
});

describe('search and discovery', () => {
  it('lists the hubs and one url per item, and no per-framework item urls', () => {
    expect(TEMPLATE_PATHS).toHaveLength(1 + HUB_SLUGS.length + LIBRARY_SIZE);
    expect(TEMPLATE_PATHS.filter((p) => /\/templates\/[^/]+\/[^/]+/.test(p) && !p.includes('/preview/'))).toEqual([]);
  });

  it('puts every template page in the site paths, the sitemap, llms.txt and llms-full', () => {
    for (const path of TEMPLATE_PATHS) {
      expect(SITE_PATHS).toContain(path);
      expect(sitemapXml()).toContain(`https://www.feega.app${path}</loc>`);
      expect(llmsTxt()).toContain(`https://www.feega.app${path}`);
      expect(llmsFullTxt()).toContain(`https://www.feega.app${path}`);
    }
  });

  it('keeps the preview frames out of the sitemap', () => {
    expect(sitemapXml()).not.toContain('/templates/preview/');
  });

  it('titles every template page for breadcrumbs', () => {
    for (const path of TEMPLATE_PATHS) {
      expect(PAGE_TITLES[path]).toBeTruthy();
    }
  });

  it('an item declares a free software source code work on the canonical url', () => {
    const template = templateById('hero-centered')!;
    const data = JSON.parse(templateJsonLd(template, 'd').replace(/^<script[^>]*>|<\/script>$/g, ''));
    expect(data['@type']).toEqual(['CreativeWork', 'SoftwareSourceCode']);
    expect(data.url).toBe(`https://www.feega.app${templatePath('hero-centered')}`);
    expect(data.isAccessibleForFree).toBe(true);
  });

  it('a hub declares a collection page listing its items', () => {
    const data = JSON.parse(collectionJsonLd({ name: 'n', description: 'd', path: frameworkPath(Framework.Svelte) }, [{ name: 'a', path: '/templates/a' }]).replace(/^<script[^>]*>|<\/script>$/g, ''));
    expect(data['@type']).toBe('CollectionPage');
    expect(data.mainEntity.itemListElement).toHaveLength(1);
  });
});

describe('what each item page says', () => {
  it('lists the tokens an item reads, with their meaning', () => {
    const tokens = tokensUsed('.a{color:var(--feega-fg);background:var(--feega-bg);border:1px solid var(--feega-fg)}');
    expect(tokens[0]).toMatchObject({ token: '--feega-fg', uses: 2 });
  });

  it.each(TEMPLATES.filter((t) => t.tier === Tier.Free).map((t) => t.id))('%s has facts of its own and six related templates', async (id) => {
    const template = templateById(id)!;
    const [parts, code] = await Promise.all([previewParts(template), codeOf(template)]);
    const facts = factsOf(template, parts, code);
    expect(facts.intro).toContain(template.name);
    expect(facts.tokens.length).toBeGreaterThan(0);
    expect(facts.sizes).toHaveLength(Object.values(Framework).length);
    expect(relatedTo(template)).toHaveLength(6);
    expect(relatedTo(template).map((t) => t.id)).not.toContain(id);
  });

  it('says an item with a script has behaviour, and one without has none', async () => {
    const [tabs, card] = ['tabs', 'card'].map((id) => templateById(id)!);
    const describeOf = async (t: typeof tabs) => factsOf(t, await previewParts(t), await codeOf(t)).behaviour;
    expect(await describeOf(tabs)).toMatch(/has behaviour/);
    expect(await describeOf(card)).toMatch(/no script/);
  });
});

describe('a pro item', () => {
  const pro = templateById(PRO_ID)!;

  it('is read from the library as pro', () => {
    expect(pro.tier).toBe(Tier.Pro);
  });

  it('has no live preview page, so its html never ships', () => {
    expect(PREVIEWABLE.map((t) => t.id)).not.toContain(PRO_ID);
    expect(PREVIEWABLE).toHaveLength(TEMPLATES.length - 1);
  });

  it('has no source to read, not even for the facts', async () => {
    expect(await previewParts(pro)).toEqual({ markup: '', css: '' });
    const facts = factsOf(pro, await previewParts(pro), await codeOf(pro));
    expect(facts.intro).toContain('Feega Cloud');
    expect(facts.intro).not.toMatch(/free/i);
  });

  it('is not called free in its title or description', () => {
    const meta = templateMeta(pro);
    expect(`${meta.title} ${meta.description}`).not.toMatch(/free/i);
  });

  it('has a looping preview video and a poster', () => {
    for (const file of [proVideoPath(PRO_ID, VideoFormat.Webm), proVideoPath(PRO_ID, VideoFormat.Mp4), proPosterPath(PRO_ID)]) {
      expect(existsSync(resolve(STATIC, file.slice(1))), file).toBe(true);
    }
  });
});

describe('the preview document', () => {
  it('is noindex, themed from the hash and loads the item markup and tokens', async () => {
    const template = templateById('hero-centered')!;
    const html = previewDocument(template, await previewParts(template), TOKENS_CSS);
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).toContain("location.hash === '#light'");
    expect(html).toContain('--feega-accent');
    expect(html).toContain('fl-hero-centered');
  });
});
