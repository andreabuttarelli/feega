import { APPLE_ICON, LINUX_ICON, WINDOWS_ICON } from './social-icons';
import { DESKTOP_DMGS, DESKTOP_LINUX, DESKTOP_WINDOWS, DOWNLOAD_PATH } from './links';

export enum Os {
  Mac = 'mac',
  Windows = 'windows',
  Linux = 'linux',
  Unknown = 'unknown'
}

export type DesktopDownload = { label: string; href: string; target: string; icon: string };

export const DOWNLOAD_LABEL = 'download for free';

const MOBILE = /android|iphone|ipad|ipod/i;

const OS_PATTERNS: readonly (readonly [Os, RegExp])[] = [
  [Os.Mac, /macintosh|mac os x/i],
  [Os.Windows, /windows/i],
  [Os.Linux, /linux|x11/i]
];

const DOWNLOADS: Record<Os, DesktopDownload> = {
  [Os.Mac]: { label: DOWNLOAD_LABEL, href: DESKTOP_DMGS[0].href, target: DESKTOP_DMGS[0].target, icon: APPLE_ICON },
  [Os.Windows]: { label: DOWNLOAD_LABEL, href: DESKTOP_WINDOWS.href, target: DESKTOP_WINDOWS.target, icon: WINDOWS_ICON },
  [Os.Linux]: { label: DOWNLOAD_LABEL, href: DESKTOP_LINUX.href, target: DESKTOP_LINUX.target, icon: LINUX_ICON },
  [Os.Unknown]: { label: DOWNLOAD_LABEL, href: DOWNLOAD_PATH, target: 'download_page', icon: '' }
};

export const detectOs = (userAgent: string): Os => {
  if (MOBILE.test(userAgent)) {
    return Os.Unknown;
  }

  return OS_PATTERNS.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? Os.Unknown;
};

export const downloadFor = (os: Os): DesktopDownload => DOWNLOADS[os];
