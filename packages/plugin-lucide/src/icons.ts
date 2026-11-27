import { unpack } from '@feega/plugin-icon-kit/unpack';
import { PACKED, VERSION } from './packed.generated';

export { VERSION };

export type LucideIcon = { name: string; words: string[] };

export const SOURCE = { name: 'lucide-static', version: VERSION };

export const VIEW_BOX = '0 0 24 24';
export const DEFAULT_SIZE = 24;
export const DEFAULT_STROKE = 2;
export const CURRENT_COLOUR = 'currentColor';

export const POPULAR = [
  'house', 'search', 'settings', 'user', 'users', 'mail', 'phone', 'heart', 'star', 'check', 'x', 'plus', 'minus', 'menu', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down',
  'chevron-right', 'chevron-down', 'external-link', 'download', 'upload', 'share-2', 'link', 'copy', 'trash', 'pencil', 'bell', 'calendar', 'clock', 'map-pin', 'globe', 'lock',
  'eye', 'camera', 'image', 'play', 'shopping-cart', 'credit-card', 'zap', 'sparkles', 'sun', 'moon', 'message-circle', 'info', 'bookmark', 'circle-check'
];

export async function loadIcons(): Promise<LucideIcon[]> {
  const packed = await unpack<Record<string, string[]>>(PACKED);

  return Object.entries(packed).map(([name, words]) => ({ name, words }));
}

export const fileOf = (icon: LucideIcon): string => `icons/${icon.name}.svg`;
