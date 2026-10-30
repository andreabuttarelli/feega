import { homedir } from 'node:os';
import { join } from 'node:path';

export const FIDELITY_PAGES: Record<string, string> = {
  vercel: 'https://vercel.com/',
  linear: 'https://linear.app/',
  stripe: 'https://stripe.com/',
  apple: 'https://www.apple.com/macbook-air/',
  framer: 'https://www.framer.com/',
  webflow: 'https://webflow.com/',
  tailwind: 'https://tailwindcss.com/docs/installation/using-vite',
  blog: 'https://overreacted.io/a-chain-reaction/'
};

export const FIDELITY_DIR = join(homedir(), 'Documents/feega-videos/url-import/fidelity2');

export const capturedIn = (label: string) => join(FIDELITY_DIR, 'captures', label);

export const scoredIn = (label: string) => join(FIDELITY_DIR, 'runs', label);
