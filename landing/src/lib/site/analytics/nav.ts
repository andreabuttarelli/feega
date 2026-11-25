import { eventAttrs } from './attrs';
import { DOCS_URL, DOWNLOAD_PATH } from '../links';

type Attrs = Record<string, string>;

const TRACKED_LINKS: Readonly<Record<string, (place: string) => Attrs>> = {
  [DOCS_URL]: (place) => eventAttrs('docs_click', { place }),
  [DOWNLOAD_PATH]: (place) => eventAttrs('download_click', { target: 'download_page', place })
};

export const navAttrs = (href: string, place: string): Attrs => TRACKED_LINKS[href]?.(place) ?? {};

type MenuOption = { label: string; command?: string };

export const installOptionAttrs = (option: MenuOption, place: string): Attrs =>
  eventAttrs('download_click', { target: (option.command ?? option.label).toLowerCase(), place });
