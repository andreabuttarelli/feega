import { DISCORD_ICON, GITHUB_ICON, INSTAGRAM_ICON, X_ICON } from './social-icons';

export const SITE_URL = 'https://www.feega.app';
export const APP_URL = 'https://oh.feega.app';
export const GITHUB_URL = 'https://github.com/andreabuttarelli/feega';
export const DOCS_URL = 'https://docs.feega.app';
export const DISCORD_URL = 'https://discord.gg/PUp37DG6vr';
export const STORY_URL = 'https://blog.feega.app/';
export const COFFEE_URL = 'https://buy.stripe.com/5kQ00k2A97C08sd94LeME07';

export const EXTENSION_PUBLISHED = true;

export const DESKTOP_PUBLISHED = true;

export const DESKTOP_RELEASE_URL = `${GITHUB_URL}/releases/download/desktop-latest`;

export const DESKTOP_INSTALL_COMMAND = `curl -fsSL ${SITE_URL}/install | sh`;

export const DESKTOP_DMGS = [
  { arch: 'Apple silicon', href: `${DESKTOP_RELEASE_URL}/Feega-mac-arm64.dmg` },
  { arch: 'Intel', href: `${DESKTOP_RELEASE_URL}/Feega-mac-x64.dmg` }
] as const;

export const DESKTOP_WINDOWS = { href: `${DESKTOP_RELEASE_URL}/Feega-win-x64.exe` } as const;

export const DESKTOP_LINUX_FILE = 'Feega-linux-x64.AppImage';

export const DESKTOP_LINUX = { href: `${DESKTOP_RELEASE_URL}/${DESKTOP_LINUX_FILE}` } as const;

export const DOWNLOAD_PATH = '/download';

export const FEEGA_VERSION = __FEEGA_VERSION__;

export const NODE_REQUIREMENT = 'Node 20 or newer';

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
  { href: '/templates', label: 'Templates' },
  { href: DOCS_URL, label: 'Docs' },
  { href: STORY_URL, label: 'Blog' },
  { href: '/plugins', label: 'Plugins' },
  { href: '/pricing', label: 'Pricing' },
  { href: DISCORD_URL, label: 'Community' }
] as const;

export const SOCIAL_LINKS = [
  { href: DISCORD_URL, label: 'Discord', icon: DISCORD_ICON },
  { href: GITHUB_URL, label: 'GitHub', icon: GITHUB_ICON },
  { href: 'https://x.com/andreabttrll', label: 'X', icon: X_ICON },
  { href: 'https://www.instagram.com/andrea_buttarelli', label: 'Instagram', icon: INSTAGRAM_ICON }
] as const;
