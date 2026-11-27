import { unpack } from '@feega/plugin-icon-kit/unpack';
import { PACKED } from './packed.generated';

export type Logo = { name: string; title: string; hex: string; path: string; words: string[] };

export const VIEW_BOX = '0 0 24 24';
export const DEFAULT_SIZE = 24;
export const CURRENT_COLOUR = 'currentColor';

export const POPULAR = [
  'github', 'x', 'facebook', 'instagram', 'youtube', 'tiktok', 'discord', 'google', 'apple', 'stripe', 'paypal', 'shopify',
  'figma', 'notion', 'vercel', 'netlify', 'react', 'svelte', 'vuedotjs', 'nextdotjs', 'astro', 'tailwindcss', 'typescript', 'javascript', 'nodedotjs', 'docker', 'npm', 'supabase',
  'spotify', 'whatsapp', 'telegram', 'reddit', 'pinterest', 'twitch', 'dropbox', 'airbnb', 'uber', 'netflix', 'bluesky', 'mastodon', 'vite', 'git', 'anthropic', 'cloudflare', 'gitlab', 'linear', 'framer', 'python', 'postgresql', 'firebase', 'zoom', 'steam'
];

export async function loadLogos(): Promise<Logo[]> {
  const packed = await unpack<Record<string, [string, string, string]>>(PACKED);

  return Object.entries(packed).map(([name, [title, hex, path]]) => ({ name, title, hex, path, words: [title.toLowerCase()] }));
}

export const glyphOf = (logo: Logo): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}"><path d="${logo.path}"/></svg>`;

export const escaped = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const bodyOf = (logo: Logo): string => `<title>${escaped(logo.title)}</title><path d="${logo.path}"/>`;
