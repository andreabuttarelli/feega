import { DISCORD_ICON, GITHUB_ICON, INSTAGRAM_ICON, X_ICON } from './social-icons';

export const SITE_URL = 'https://www.feega.app';
export const APP_URL = 'https://oh.feega.app';
export const GITHUB_URL = 'https://github.com/andreabuttarelli/feega';
export const DOCS_URL = 'https://docs.feega.app';
export const DISCORD_URL = 'https://discord.gg/PUp37DG6vr';
export const STORY_URL = 'https://blog.feega.app/';
export const COFFEE_URL = 'https://buy.stripe.com/5kQ00k2A97C08sd94LeME07';

export const EXTENSION_PUBLISHED = true;

export const DOWNLOAD_PATH = '/download';

export const FEEGA_VERSION = '0.2.3';

export const NODE_REQUIREMENT = 'Node 18 or newer';

export const VSCODE_REQUIREMENT = 'VS Code 1.90 or newer';

const EXTENSION_ID = 'andreabuttarelli.feega';

export const OPEN_VSX_URL = 'https://open-vsx.org/extension/AndreaButtarelli/feega';

export const NPX_COMMAND = 'npx feega';

export const NPX_LISTED = true;

export const MARKETPLACE_URL = `https://marketplace.visualstudio.com/items?itemName=${EXTENSION_ID}`;

export type Editor = { id: string; label: string; installUrl: string; webUrl: string; listed: boolean };

export const EDITORS: readonly Editor[] = [
  { id: 'vscode', label: 'VS Code', installUrl: `vscode:extension/${EXTENSION_ID}`, webUrl: MARKETPLACE_URL, listed: true },
  { id: 'cursor', label: 'Cursor', installUrl: `cursor:extension/${EXTENSION_ID}`, webUrl: OPEN_VSX_URL, listed: true },
  { id: 'windsurf', label: 'Windsurf', installUrl: `windsurf:extension/${EXTENSION_ID}`, webUrl: OPEN_VSX_URL, listed: true },
  { id: 'openvsx', label: 'VSCodium / Open VSX', installUrl: OPEN_VSX_URL, webUrl: OPEN_VSX_URL, listed: true }
];

export const HEADER_LINKS = [
  { href: DOWNLOAD_PATH, label: 'Download' },
  { href: DOCS_URL, label: 'Documentation' },
  { href: DISCORD_URL, label: 'Community' },
  { href: '/pricing', label: 'Pricing' }
] as const;

export const MENU_LINKS = [
  { href: DOWNLOAD_PATH, label: 'Download' },
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
