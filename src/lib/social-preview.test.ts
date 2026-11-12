import { describe, expect, it } from 'vitest';
import { HOME_META, OG } from '../../landing/src/lib/site/seo';
import { SOCIAL_PREVIEW, previewTags } from './social-preview';

const content = (tags: ReturnType<typeof previewTags>, id: string) => tags.find((t) => t.id === id)?.content;

describe('social preview', () => {
  it('uses the landing home copy and the landing preview files', () => {
    expect(SOCIAL_PREVIEW).toMatchObject({ title: HOME_META.title, description: HOME_META.description, image: OG.image.url, video: OG.video.url, alt: OG.image.alt, width: OG.image.width, height: OG.image.height });
  });

  it('a page without its own image gets the shared image and video', () => {
    const tags = previewTags('https://oh.feega.app/login');
    expect(content(tags, 'og:image')).toBe(OG.image.url);
    expect(content(tags, 'og:video')).toBe(OG.video.url);
    expect(content(tags, 'og:url')).toBe('https://oh.feega.app/login');
  });

  it('a page with its own image keeps it and drops the shared video', () => {
    const tags = previewTags('https://oh.feega.app/gallery/1', 'https://cdn.example/poster.jpg');
    expect(content(tags, 'og:image')).toBe('https://cdn.example/poster.jpg');
    expect(content(tags, 'og:video')).toBeUndefined();
    expect(tags.filter((t) => t.id === 'og:image')).toHaveLength(1);
  });
});
