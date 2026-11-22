import { PixelIcon } from './alternatives/pixel';
import { HEADER_LINKS } from './links';

export const LIBRARY_LABEL = 'library';

export type LibraryItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: PixelIcon;
  readonly describe: (freeTemplates: number) => string;
};

export const LIBRARY_ITEMS: readonly LibraryItem[] = [
  {
    href: '/templates',
    label: 'templates',
    icon: PixelIcon.Templates,
    describe: () => 'free sections and components for Svelte, React, Vue and Astro'
  },
  { href: '/plugins', label: 'plugins', icon: PixelIcon.Plugin, describe: () => 'extend the editor' }
];

const LIBRARY_HREFS: readonly string[] = LIBRARY_ITEMS.map((item) => item.href);

export const inLibrary = (pathname: string, hrefs: readonly string[] = LIBRARY_HREFS): boolean =>
  hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));

export type NavEntry = { readonly href: string; readonly label: string } | { readonly library: true };

export const desktopNav: readonly NavEntry[] = HEADER_LINKS.flatMap((link): NavEntry[] => {
  if (link.href === LIBRARY_HREFS[0]) {
    return [{ library: true }];
  }

  return LIBRARY_HREFS.includes(link.href) ? [] : [link];
});
