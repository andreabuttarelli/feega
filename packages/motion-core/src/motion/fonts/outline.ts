import { BuiltinFont, FontSource, isBuiltin, loadedWeight, nearestWeight, variantsOf, type FontFace } from './model';

const OUTLINE_CDN = 'https://cdn.jsdelivr.net/fontsource/fonts/';

const BUILTIN_FAMILY: Record<BuiltinFont, string> = {
  [BuiltinFont.Sans]: 'DM Sans',
  [BuiltinFont.Mono]: 'Fragment Mono'
};

const slug = (family: string) => family.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function outlineUrl(family: string, asked: number, registry: readonly FontFace[], assets: Record<string, string>): string | null {
  const face = registry.find((f) => f.family === family);
  if (face?.source === FontSource.Upload) {
    const files = variantsOf(face).filter((v) => !v.italic && assets[v.assetId]);
    const weight = files.length ? nearestWeight(asked, files.map((v) => v.weight)) : null;
    const file = files.find((v) => v.weight === weight);
    return file ? assets[file.assetId] : null;
  }
  const name = isBuiltin(family) ? BUILTIN_FAMILY[family] : family;
  return `${OUTLINE_CDN}${slug(name)}@latest/latin-${loadedWeight(family, asked, registry)}-normal.woff`;
}
