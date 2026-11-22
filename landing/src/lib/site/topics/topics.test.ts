import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITOR_SHOTS } from '../editor-shots';
import { SITE_PATHS } from '../paths';
import { llmsFullTxt, llmsTxt } from '../llms';
import { HUBS, linkLabel } from '.';
import { topicPath, topicText, wordsIn, type Topic } from './topic';
import { breadcrumbJsonLd, topicJsonLd } from '../structured-data';
import { trailOf } from '../llms';

const STATIC_DIR = resolve(import.meta.dirname, '../../../../static');
const FOOTER = readFileSync(resolve(import.meta.dirname, '../SiteFooter.svelte'), 'utf8');
const KB = 1024;
const MAX_IMAGE_KB = 80;
const MAX_SHOT_KB = 160;
const MAX_FIGURES = 5;
const MIN_WORDS = 1000;
const READ_NEXT = 6;

const pages: [string, Topic][] = HUBS.flatMap((hub) => Object.entries(hub.topics).map(([slug, t]) => [topicPath(hub, slug), t] as [string, Topic]));

const AI_TELLS = [
  /\bit'?s not (just )?[^.,;]+, it'?s\b/i,
  /\bnot just\b/i,
  /\b(seamless(ly)?|effortless(ly)?|game[- ]chang\w*|unlock\w*|supercharg\w*|leverag\w*|delve|revolution\w*|cutting[- ]edge|robust|powerful|blazing|magic\w*|elevate|empower\w*|streamlin\w*|in today's)\b/i,
  /—/
];

const prose = (t: Topic) => [topicText(t), t.title, t.description, t.hook].join('\n');

describe('topic pages', () => {
  it('batch 1 has five frameworks and four editors', () => {
    expect(pages.map(([path]) => path)).toEqual([
      '/for/react',
      '/for/nextjs',
      '/for/sveltekit',
      '/for/vue',
      '/for/tailwind',
      '/integrations/vscode',
      '/integrations/cursor',
      '/integrations/windsurf',
      '/integrations/vscodium'
    ]);
  });

  it.each(pages)('%s is at least 1,000 words', (_, t) => {
    expect(wordsIn(topicText(t))).toBeGreaterThanOrEqual(MIN_WORDS);
  });

  it.each(pages)('%s has a 50 to 60 character title and a 120 to 155 character description', (_, t) => {
    expect(t.title.length).toBeGreaterThanOrEqual(50);
    expect(t.title.length).toBeLessThanOrEqual(60);
    expect(t.description.length).toBeGreaterThanOrEqual(120);
    expect(t.description.length).toBeLessThanOrEqual(155);
  });

  it.each(pages)('%s answers first in one or two sentences', (_, t) => {
    expect(t.short.split(/(?<=\.)\s/).length).toBeLessThanOrEqual(2);
  });

  it.each(pages)('%s has the template parts', (_, t) => {
    expect(t.questions.length).toBeGreaterThanOrEqual(3);
    expect(t.questions.length).toBeLessThanOrEqual(5);
    expect(t.mistakes.length).toBeGreaterThanOrEqual(3);
    expect(t.sources.length).toBeGreaterThanOrEqual(3);
    expect(t.tryIt.length).toBeGreaterThanOrEqual(3);
    expect(t.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(pages)('%s reads next into six live pages', (path, t) => {
    expect(t.readNext).toHaveLength(READ_NEXT);
    expect(t.readNext).not.toContain(path);
    for (const next of t.readNext) {
      expect(SITE_PATHS).toContain(next);
      expect(linkLabel(next)).toBeTruthy();
    }
  });

  it.each(pages)('%s has two to five light images with alt text', (_, t) => {
    const shots = t.sections.flatMap((s) => (s.editor ? [EDITOR_SHOTS[s.editor]] : []));
    const figures = [t.cover, ...t.sections.flatMap((s) => (s.figure ? [s.figure] : [])), ...shots];
    expect(figures.length).toBeGreaterThanOrEqual(2);
    expect(figures.length).toBeLessThanOrEqual(MAX_FIGURES);
    for (const f of figures) {
      const file = resolve(STATIC_DIR, f.src.slice(1));
      expect(existsSync(file), f.src).toBe(true);
      expect(f.src).toMatch(/\.webp$/);
      expect(statSync(file).size).toBeLessThanOrEqual((shots.some((x) => x.src === f.src) ? MAX_SHOT_KB : MAX_IMAGE_KB) * KB);
      expect(f.alt.length).toBeGreaterThan(30);
    }
  });

  it.each(pages)('%s reads like a person wrote it', (_, t) => {
    for (const tell of AI_TELLS) {
      expect(prose(t)).not.toMatch(tell);
    }
    expect(prose(t).replace(/npx feega|feega\.app|feegaInspect|data-feega-src|\.feega-inspect|andreabuttarelli\.feega|AndreaButtarelli\/feega|github\.com\/andreabuttarelli\/feega/g, '')).not.toMatch(/\bfeega\b/);
  });

  it.each(pages)('%s declares an article, a breadcrumb and the organization', (path, t) => {
    const types = [...topicJsonLd(t, path).matchAll(/"@type":"(\w+)"/g)].map((m) => m[1]);
    expect(types).toEqual(expect.arrayContaining(['Article', 'Organization', 'FAQPage']));
    expect(topicJsonLd(t, path)).toContain(`"dateModified":"${t.checked}"`);
    const crumbs = JSON.parse(breadcrumbJsonLd(trailOf(path)).replace(/^<script[^>]*>|<\/script>$/g, ''));
    expect(crumbs.itemListElement.map((i: { item: string }) => i.item)).toEqual(['https://www.feega.app/', `https://www.feega.app${path.slice(0, path.lastIndexOf('/'))}`, `https://www.feega.app${path}`]);
  });
});

describe('topic hubs', () => {
  it.each(HUBS.map((h) => [h.path, h] as const))('%s and its pages are in the sitemap and llms.txt', (path, hub) => {
    expect(SITE_PATHS).toContain(path);
    for (const slug of Object.keys(hub.topics)) {
      expect(SITE_PATHS).toContain(topicPath(hub, slug));
      expect(llmsTxt()).toContain(`https://www.feega.app${topicPath(hub, slug)}`);
      expect(llmsFullTxt()).toContain(hub.topics[slug].short);
    }
  });

  it('the footer links every hub', () => {
    expect(FOOTER).toMatch(/\{#each HUBS as hub/);
    expect(FOOTER).toContain('href={hub.path}');
  });

  it.each(HUBS.map((h) => [h.path, h] as const))('%s fits the meta limits', (_, hub) => {
    expect(hub.title.length).toBeLessThanOrEqual(60);
    expect(hub.description.length).toBeLessThanOrEqual(155);
  });
});
