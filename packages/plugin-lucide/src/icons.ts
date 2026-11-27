import { unpack } from '@feega/plugin-icon-kit/unpack';
import { PACKED } from './packed.generated';

export type LucideIcon = { name: string; body: string; words: string[] };

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
  const packed = await unpack<Record<string, [string, string[]]>>(PACKED);

  return Object.entries(packed).map(([name, [body, words]]) => ({ name, body, words }));
}

const GLYPH_STROKE = `fill="none" stroke="#000" stroke-width="${DEFAULT_STROKE}" stroke-linecap="round" stroke-linejoin="round"`;

export const glyphOf = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" ${GLYPH_STROKE}>${body}</svg>`;
