import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOCIAL_PREVIEW, previewTags } from './social-preview';

const LANDING = resolve(import.meta.dirname, '../../landing');
const landingSource = (path: string) => readFileSync(resolve(LANDING, 'src/lib/site', path), 'utf8');
const content = (tags: ReturnType<typeof previewTags>, id: string) => tags.find((t) => t.id === id)?.content;

describe('social preview', () => {
  it('uses the landing home copy, word for word', () => {
    const seo = landingSource('seo.ts');
    expect(seo).toContain(`title: '${SOCIAL_PREVIEW.title}'`);
    expect(seo).toContain(`description: '${SOCIAL_PREVIEW.description}'`);
  });

  it('describes the image with the landing alt: the hero headline, then the scene', () => {
    const [, first, second] = landingSource('home.ts').match(/HERO_HEADLINE = \['([^']+)', '([^']+)'\]/) ?? [];
    const [, scene] = landingSource('seo.ts').match(/OG_IMAGE_ALT = `Feega: \$\{HERO_HEADLINE\.join\(' '\)\} ([^`]+)`/) ?? [];
    expect(SOCIAL_PREVIEW.alt).toBe(`Feega: ${first} ${second} ${scene}`);
  });

  it('points at files the landing serves', () => {
    for (const url of [SOCIAL_PREVIEW.image, SOCIAL_PREVIEW.video]) {
      expect(url).toMatch(/^https:\/\/feega\.app\//);
      expect(existsSync(resolve(LANDING, 'static', new URL(url).pathname.slice(1)))).toBe(true);
    }
  });

  it('a page without its own image gets the shared image and video', () => {
    const tags = previewTags('https://oh.feega.app/login');
    expect(content(tags, 'og:image')).toBe(SOCIAL_PREVIEW.image);
    expect(content(tags, 'og:video')).toBe(SOCIAL_PREVIEW.video);
    expect(content(tags, 'og:url')).toBe('https://oh.feega.app/login');
  });

  it('a page with its own image keeps it and drops the shared video', () => {
    const tags = previewTags('https://oh.feega.app/gallery/1', 'https://cdn.example/poster.jpg');
    expect(content(tags, 'og:image')).toBe('https://cdn.example/poster.jpg');
    expect(content(tags, 'og:video')).toBeUndefined();
    expect(tags.filter((t) => t.id === 'og:image')).toHaveLength(1);
  });
});
