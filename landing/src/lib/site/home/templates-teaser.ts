import { TEMPLATES } from '../templates/library';
import { shotPath, templatePath, TEMPLATES_PATH } from '../templates/paths';
import { Theme } from '../templates/template';

const FEATURED_IDS = ['hero-bento', 'features-grid', 'hero-split', 'pricing', 'testimonials-grid', 'bento-grid'] as const;

const SHOT_SIZE = { width: 640, height: 400 } as const;

export const TEASER_EYEBROW = 'free library';

export const TEASER_COPY = 'Svelte, React, Vue and Astro. Insert one from the editor’s Library, or copy the code.';

export const TEASER_CTA = { label: 'browse templates', href: TEMPLATES_PATH } as const;

export const teaserTitle = (): string => 'free templates, ready to drop in';

export type TeaserShot = { id: string; name: string; href: string; src: string; alt: string; width: number; height: number };

export const teaserShots = (): TeaserShot[] =>
  FEATURED_IDS.flatMap((id) => {
    const template = TEMPLATES.find((t) => t.id === id);

    if (!template) {
      return [];
    }

    return [
      {
        id,
        name: template.name,
        href: templatePath(id),
        src: shotPath(id, Theme.Light),
        alt: `${template.name} template preview`,
        ...SHOT_SIZE
      }
    ];
  });
