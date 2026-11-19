import { HERO_HEADLINE } from './home';
import { SITE_URL } from './links';

export const HOME_META = {
  title: 'Feega: design in your codebase',
  description: 'Feega: design in your codebase. A free VS Code extension: click any element of your running app, edit it like in Figma, and the change is written to your code.'
} as const;

export const OG_IMAGE_ALT = `Feega: ${HERO_HEADLINE.join(' ')} An isometric canvas where code becomes a design, a layout gets a timeline and a prompt wires into image and video nodes.`;

export const OG = {
  image: { url: `${SITE_URL}/og.png`, type: 'image/png', width: 1200, height: 630, alt: OG_IMAGE_ALT },
  video: { url: `${SITE_URL}/og.mp4`, type: 'video/mp4', width: 1200, height: 630 }
} as const;

export const PRICING_META = {
  title: 'Pricing: the Feega extension is free | Feega',
  description: 'The Feega VS Code extension is free. Feega Cloud, with GitHub sync, collaboration, sections and templates, is coming later.'
} as const;
