import { HERO_HEADLINE } from './home';
import { SITE_URL } from './links';

export const HOME_META = {
  title: 'Feega: design in your codebase',
  description: 'Feega is free, in VS Code or with npx feega: click an element of your running app, edit it like in Figma, and the change lands in your code.'
} as const;

export const OG_IMAGE_ALT = `Feega: ${HERO_HEADLINE}. A heading selected in a running app inside the Feega editor, next to a code diff where its size changes from 64px to 88px.`;

export const OG = {
  image: { url: `${SITE_URL}/og.png`, type: 'image/png', width: 1200, height: 630, alt: OG_IMAGE_ALT },
  video: { url: `${SITE_URL}/og.mp4`, type: 'video/mp4', width: 1200, height: 630 }
} as const;

export const PRICING_META = {
  title: 'Pricing: the Feega extension is free | Feega',
  description: 'The Feega VS Code extension is free. Feega Cloud, with GitHub sync, collaboration, sections and templates, is coming soon.'
} as const;

export const PLUGINS_META = {
  title: 'Plugins for Feega | Feega',
  description: 'Browse the plugins for Feega: mesh gradients, 3D objects and more. You choose which ones are on, and each lists the permissions it asks for.'
} as const;

export const DOWNLOAD_META = {
  title: 'Download Feega: free VS Code extension | Feega',
  description: 'Download Feega for VS Code, Cursor, Windsurf and VSCodium, or run npx feega. Free, open source, no account.'
} as const;
