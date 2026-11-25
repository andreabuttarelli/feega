import { DESKTOP_DMGS, DESKTOP_LINUX, DESKTOP_WINDOWS, DOWNLOAD_PATH } from './links';

export enum Os {
  Mac = 'mac',
  Windows = 'windows',
  Linux = 'linux',
  Unknown = 'unknown'
}

export type DesktopDownload = { label: string; href: string; target: string };

const MOBILE = /android|iphone|ipad|ipod/i;

const OS_PATTERNS: readonly (readonly [Os, RegExp])[] = [
  [Os.Mac, /macintosh|mac os x/i],
  [Os.Windows, /windows/i],
  [Os.Linux, /linux|x11/i]
];

const DOWNLOADS: Record<Os, DesktopDownload> = {
  [Os.Mac]: { label: 'download for mac', href: DESKTOP_DMGS[0].href, target: 'dmg_apple_silicon' },
  [Os.Windows]: { label: 'download for windows', href: DESKTOP_WINDOWS.href, target: 'windows_exe' },
  [Os.Linux]: { label: 'download for linux', href: DESKTOP_LINUX.href, target: 'linux_appimage' },
  [Os.Unknown]: { label: 'download', href: DOWNLOAD_PATH, target: 'download_page' }
};

export const detectOs = (userAgent: string): Os => {
  if (MOBILE.test(userAgent)) {
    return Os.Unknown;
  }

  return OS_PATTERNS.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? Os.Unknown;
};

export const downloadFor = (os: Os): DesktopDownload => DOWNLOADS[os];
