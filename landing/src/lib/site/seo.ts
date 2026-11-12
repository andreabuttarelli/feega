import { HERO_HEADLINE } from './home';
import { SITE_URL } from './links';

export const HOME_META = {
  title: 'Feega: design inside your code with your agents and team',
  description: 'Feega: design inside your code with your agents and team. An open-source canvas to design, animate and generate, from your repo, Figma or any website.'
} as const;

export const OG_IMAGE_ALT = `Feega: ${HERO_HEADLINE.join(' ')} An isometric canvas where code becomes a design, a layout gets a timeline and a prompt wires into image and video nodes.`;

export const OG = {
  image: { url: `${SITE_URL}/og.png`, type: 'image/png', width: 1200, height: 630, alt: OG_IMAGE_ALT },
  video: { url: `${SITE_URL}/og.mp4`, type: 'video/mp4', width: 1200, height: 630 }
} as const;
