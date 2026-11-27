import { unpack } from '@feega/plugin-icon-kit/unpack';
import { PACKED, VERSION } from './packed.generated';

export { VERSION };

export type Logo = { name: string; title: string; hex: string; words: string[] };

export const SOURCE = { name: 'simple-icons', version: VERSION };

export const VIEW_BOX = '0 0 24 24';
export const DEFAULT_SIZE = 24;
export const CURRENT_COLOUR = 'currentColor';

export const POPULAR = [
  'github', 'x', 'facebook', 'instagram', 'youtube', 'tiktok', 'discord', 'google', 'apple', 'stripe', 'paypal', 'shopify',
  'figma', 'notion', 'vercel', 'netlify', 'react', 'svelte', 'vuedotjs', 'nextdotjs', 'astro', 'tailwindcss', 'typescript', 'javascript', 'nodedotjs', 'docker', 'npm', 'supabase',
  'spotify', 'whatsapp', 'telegram', 'reddit', 'pinterest', 'twitch', 'dropbox', 'airbnb', 'uber', 'netflix', 'bluesky', 'mastodon', 'vite', 'git', 'anthropic', 'cloudflare', 'gitlab', 'linear', 'framer', 'python', 'postgresql', 'firebase', 'zoom', 'steam'
];

export async function loadLogos(): Promise<Logo[]> {
  const packed = await unpack<Record<string, [string, string]>>(PACKED);

  return Object.entries(packed).map(([name, [title, hex]]) => ({ name, title, hex, words: [title.toLowerCase()] }));
}

export const fileOf = (logo: Logo): string => `icons/${logo.name}.svg`;
