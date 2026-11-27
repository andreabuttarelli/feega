import { unpack } from '@feega/plugin-icon-kit/unpack';
import { PACKED, VERSION } from './packed.generated';

export enum Weight {
  Thin = 'thin',
  Light = 'light',
  Regular = 'regular',
  Bold = 'bold',
  Fill = 'fill',
  Duotone = 'duotone'
}

export const WEIGHTS: Weight[] = [Weight.Thin, Weight.Light, Weight.Regular, Weight.Bold, Weight.Fill, Weight.Duotone];

export { VERSION };

export type PhosphorIcon = { name: string; words: string[] };

export const SOURCE = { name: '@phosphor-icons/core', version: VERSION };

export const VIEW_BOX = '0 0 256 256';
export const DEFAULT_SIZE = 24;
export const CURRENT_COLOUR = 'currentColor';

export const POPULAR = [
  'house', 'magnifying-glass', 'gear', 'user', 'users', 'envelope', 'phone', 'heart', 'star', 'check', 'x', 'plus', 'minus', 'list', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down',
  'caret-right', 'caret-down', 'arrow-square-out', 'download-simple', 'upload-simple', 'share-network', 'link', 'copy', 'trash', 'pencil-simple', 'bell', 'calendar', 'clock', 'map-pin', 'globe', 'lock',
  'eye', 'camera', 'image', 'play', 'shopping-cart', 'credit-card', 'lightning', 'sparkle', 'sun', 'moon', 'chat-circle', 'info', 'warning', 'check-circle'
];

export async function loadIcons(): Promise<PhosphorIcon[]> {
  const packed = await unpack<Record<string, string[]>>(PACKED);

  return Object.entries(packed).map(([name, words]) => ({ name, words }));
}

export const fileOf = (icon: PhosphorIcon, weight: Weight): string => `assets/${weight}/${weight === Weight.Regular ? icon.name : `${icon.name}-${weight}`}.svg`;
