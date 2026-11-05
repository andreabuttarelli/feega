import { DISCORD_ICON, GITHUB_ICON, INSTAGRAM_ICON, X_ICON } from './social-icons';

export const SITE_URL = 'https://www.feega.app';
export const APP_URL = 'https://oh.feega.app';
export const GITHUB_URL = 'https://github.com/andreabuttarelli/feega';
export const DOCS_URL = 'https://docs.feega.app';
export const DISCORD_URL = 'https://discord.gg/PUp37DG6vr';
export const STORY_URL = 'https://blog.feega.app/';

export const HEADER_LINKS = [
  { href: DOCS_URL, label: 'Documentation' },
  { href: GITHUB_URL, label: 'GitHub' },
  { href: DISCORD_URL, label: 'Community' },
  { href: '/#pricing', label: 'Pricing' }
] as const;

export const MENU_LINKS = [
  { href: DOCS_URL, label: 'Docs' },
  { href: GITHUB_URL, label: 'GitHub' },
  { href: DISCORD_URL, label: 'Community' },
  { href: '/#pricing', label: 'Pricing' },
  { href: APP_URL, label: 'Let’s start' }
] as const;

export const SOCIAL_LINKS = [
  { href: DISCORD_URL, label: 'Discord', icon: DISCORD_ICON },
  { href: GITHUB_URL, label: 'GitHub', icon: GITHUB_ICON },
  { href: 'https://x.com/andreabttrll', label: 'X', icon: X_ICON },
  { href: 'https://www.instagram.com/andrea_buttarelli', label: 'Instagram', icon: INSTAGRAM_ICON }
] as const;
