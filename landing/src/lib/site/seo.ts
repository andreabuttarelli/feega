import { SITE_URL } from './links';

export const HOME_META = {
  title: 'Feega: design inside your code with your agents and team',
  description: 'Feega: design inside your code with your agents and team. An open-source canvas to design, animate and generate, from your repo, Figma or any website.'
} as const;

export const OG_STATEMENT = 'An open-source canvas to design, animate and generate.';

export const OG = {
  image: { url: `${SITE_URL}/og.png`, type: 'image/png', width: 1200, height: 630, alt: `Feega: ${OG_STATEMENT}` },
  video: { url: `${SITE_URL}/og.mp4`, type: 'video/mp4', width: 1200, height: 630 }
} as const;
