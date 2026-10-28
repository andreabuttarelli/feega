import { PROVIDER_DEFAULT_RESOLUTION } from '$lib/canvas/gen-node';

export const DEFAULT_IMAGE_RESOLUTION = PROVIDER_DEFAULT_RESOLUTION;

const NANO_BANANA_2_TOKENS = { '512': 747, '1K': 1120, '2K': 1680, '4K': 2520 };
const NANO_BANANA_PRO_TOKENS = { '1K': 1120, '2K': 1120, '4K': 2000 };

export const IMAGE_OUTPUT_TOKENS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'google/gemini-3.1-flash-image': NANO_BANANA_2_TOKENS,
  'google/gemini-3.1-flash-image-preview': NANO_BANANA_2_TOKENS,
  'google/gemini-3-pro-image': NANO_BANANA_PRO_TOKENS,
  'google/gemini-3-pro-image-preview': NANO_BANANA_PRO_TOKENS,
  'google/gemini-2.5-flash-image': { [DEFAULT_IMAGE_RESOLUTION]: 1290 }
};

const TOKENS_BY_WIRE_PREFIX: ReadonlyArray<readonly [prefix: string, tokens: Readonly<Record<string, number>>]> = [['google/gemini-', NANO_BANANA_2_TOKENS]];

export function imageOutputTokens(wireId: string): Readonly<Record<string, number>> | undefined {
  return IMAGE_OUTPUT_TOKENS[wireId] ?? TOKENS_BY_WIRE_PREFIX.find(([prefix]) => wireId.startsWith(prefix))?.[1];
}
