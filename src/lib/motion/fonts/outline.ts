import { BuiltinFont, FontSource, isBuiltin, loadedWeight, type FontFace } from './model';

const OUTLINE_CDN = 'https://cdn.jsdelivr.net/fontsource/fonts/';

const BUILTIN_FAMILY: Record<BuiltinFont, string> = {
  [BuiltinFont.Sans]: 'DM Sans',
  [BuiltinFont.Mono]: 'Fragment Mono'
};

const slug = (family: string) => family.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function outlineUrl(family: string, weight: number, registry: readonly FontFace[], assets: Record<string, string>): string | null {
  const face = registry.find((f) => f.family === family);
  if (face?.source === FontSource.Upload) {
    return face.assetId ? (assets[face.assetId] ?? null) : null;
  }
  const name = isBuiltin(family) ? BUILTIN_FAMILY[family] : family;
  return `${OUTLINE_CDN}${slug(name)}@latest/latin-${loadedWeight(family, weight, registry)}-normal.woff`;
}
