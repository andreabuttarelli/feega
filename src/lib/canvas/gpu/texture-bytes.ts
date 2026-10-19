import type { TextureReport } from './frame-stats';

const RGBA = 4;
const MIP_CHAIN = 4 / 3;
const LARGEST = 8;

export type SourceSize = { pixelWidth: number; pixelHeight: number; autoGenerateMipmaps?: boolean; label?: string };

export const bytesOf = (s: SourceSize): number => Math.round(s.pixelWidth * s.pixelHeight * RGBA * (s.autoGenerateMipmaps ? MIP_CHAIN : 1));

export function textureReport(sources: readonly (SourceSize | null)[]): TextureReport {
  const sized = sources.filter((s): s is SourceSize => !!s).map((s) => ({ s, bytes: bytesOf(s) })).sort((a, b) => b.bytes - a.bytes);
  return {
    count: sized.length,
    bytes: sized.reduce((sum, e) => sum + e.bytes, 0),
    largest: sized.slice(0, LARGEST).map((e) => `${e.s.pixelWidth}x${e.s.pixelHeight}${e.s.autoGenerateMipmaps ? '+mip' : ''}`)
  };
}
