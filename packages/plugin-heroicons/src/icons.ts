import { unpack } from '@feega/plugin-icon-kit/unpack';
import { PACKED, VERSION } from './packed.generated';

export enum Style {
  Outline = 'outline',
  Solid = 'solid',
  Mini = 'mini',
  Micro = 'micro'
}

export const STYLES: Style[] = [Style.Outline, Style.Solid, Style.Mini, Style.Micro];

export { VERSION };

export type Hero = { name: string; styles: Style[]; words: string[] };

export const SOURCE = { name: 'heroicons', version: VERSION };

type Look = { grid: number; directory: string; stroked: boolean };

export const LOOKS: Record<Style, Look> = {
  [Style.Outline]: { grid: 24, directory: '24/outline', stroked: true },
  [Style.Solid]: { grid: 24, directory: '24/solid', stroked: false },
  [Style.Mini]: { grid: 20, directory: '20/solid', stroked: false },
  [Style.Micro]: { grid: 16, directory: '16/solid', stroked: false }
};

export const DEFAULT_SIZE = 24;
export const CURRENT_COLOUR = 'currentColor';
export const OUTLINE_STROKE = '1.5';

export const POPULAR = [
  'home', 'magnifying-glass', 'cog-6-tooth', 'user', 'users', 'envelope', 'phone', 'heart', 'star', 'check', 'x-mark', 'plus', 'minus', 'bars-3', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down',
  'chevron-right', 'chevron-down', 'arrow-top-right-on-square', 'arrow-down-tray', 'arrow-up-tray', 'share', 'link', 'document-duplicate', 'trash', 'pencil', 'bell', 'calendar', 'clock', 'map-pin', 'globe-alt', 'lock-closed',
  'eye', 'camera', 'photo', 'play', 'shopping-cart', 'credit-card', 'bolt', 'sparkles', 'sun', 'moon', 'chat-bubble-left', 'information-circle', 'exclamation-triangle', 'check-circle'
];

export async function loadIcons(): Promise<Hero[]> {
  const packed = await unpack<Record<string, string>>(PACKED);

  return Object.entries(packed).map(([name, has]) => ({ name, styles: STYLES.filter((_, index) => has[index] === '1'), words: [] }));
}

export const hasStyle = (icon: Hero, style: Style): boolean => icon.styles.includes(style);

export const fileOf = (icon: Hero, style: Style): string => `${LOOKS[style].directory}/${icon.name}.svg`;
