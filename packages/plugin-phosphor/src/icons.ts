import { unpack } from '@feega/plugin-icon-kit/unpack';
import { PACKED } from './packed.generated';

export enum Weight {
  Thin = 'thin',
  Light = 'light',
  Regular = 'regular',
  Bold = 'bold',
  Fill = 'fill',
  Duotone = 'duotone'
}

export const WEIGHTS: Weight[] = [Weight.Thin, Weight.Light, Weight.Regular, Weight.Bold, Weight.Fill, Weight.Duotone];

export type PhosphorIcon = { name: string; bodies: string[]; words: string[] };

export const VIEW_BOX = '0 0 256 256';
export const DEFAULT_SIZE = 24;
export const CURRENT_COLOUR = 'currentColor';

export const POPULAR = [
  'house', 'magnifying-glass', 'gear', 'user', 'users', 'envelope', 'phone', 'heart', 'star', 'check', 'x', 'plus', 'minus', 'list', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down',
  'caret-right', 'caret-down', 'arrow-square-out', 'download-simple', 'upload-simple', 'share-network', 'link', 'copy', 'trash', 'pencil-simple', 'bell', 'calendar', 'clock', 'map-pin', 'globe', 'lock',
  'eye', 'camera', 'image', 'play', 'shopping-cart', 'credit-card', 'lightning', 'sparkle', 'sun', 'moon', 'chat-circle', 'info', 'warning', 'check-circle'
];

export async function loadIcons(): Promise<PhosphorIcon[]> {
  const packed = await unpack<Record<string, [string[], string[]]>>(PACKED);

  return Object.entries(packed).map(([name, [bodies, words]]) => ({ name, bodies, words }));
}

export const bodyOf = (icon: PhosphorIcon, weight: Weight): string => icon.bodies[WEIGHTS.indexOf(weight)];

export const glyphOf = (icon: PhosphorIcon, weight: Weight): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" fill="#000">${bodyOf(icon, weight)}</svg>`;
