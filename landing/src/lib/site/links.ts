import { DISCORD_ICON, GITHUB_ICON, INSTAGRAM_ICON, X_ICON } from './social-icons';

export const SITE_URL = 'https://feega.app';
export const APP_URL = 'https://oh.feega.app';
export const GITHUB_URL = 'https://github.com/andreabuttarelli/feega';
export const MAC_GUIDE_URL = 'https://docs.feega.app/desktop/install-macos/';
export const DOCS_URL = 'https://docs.feega.app';
export const DISCORD_URL = 'https://discord.gg/PUp37DG6vr';
export const STORY_URL = 'https://blog.feega.app/';
export const COFFEE_URL = 'https://buymeacoffee.com/andreabuttarelli';

export const EXTENSION_PUBLISHED = false;

const EXTENSION_ID = 'andreabuttarelli.feega-inspect';

export const MARKETPLACE_URL = `https://marketplace.visualstudio.com/items?itemName=${EXTENSION_ID}`;

export type Editor = { id: string; label: string; installUrl: string };

export const EDITORS: readonly Editor[] = [
  { id: 'vscode', label: 'VS Code', installUrl: `vscode:extension/${EXTENSION_ID}` },
  { id: 'cursor', label: 'Cursor', installUrl: `cursor:extension/${EXTENSION_ID}` },
  { id: 'windsurf', label: 'Windsurf', installUrl: `windsurf:extension/${EXTENSION_ID}` },
  { id: 'openvsx', label: 'VSCodium / Open VSX', installUrl: 'https://open-vsx.org/extension/andreabuttarelli/feega-inspect' }
];

export const HEADER_LINKS = [
  { href: DOCS_URL, label: 'Documentation' },
  { href: GITHUB_URL, label: 'GitHub' },
  { href: DISCORD_URL, label: 'Community' },
  { href: '/pricing', label: 'Pricing' }
] as const;

export const MENU_LINKS = [
  { href: DOCS_URL, label: 'Docs' },
  { href: GITHUB_URL, label: 'GitHub' },
  { href: DISCORD_URL, label: 'Community' },
  { href: '/pricing', label: 'Pricing' }
] as const;

export const SOCIAL_LINKS = [
  { href: DISCORD_URL, label: 'Discord', icon: DISCORD_ICON },
  { href: GITHUB_URL, label: 'GitHub', icon: GITHUB_ICON },
  { href: 'https://x.com/andreabttrll', label: 'X', icon: X_ICON },
  { href: 'https://www.instagram.com/andrea_buttarelli', label: 'Instagram', icon: INSTAGRAM_ICON }
] as const;
