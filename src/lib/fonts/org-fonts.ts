import { variantWeight } from '@feega/motion-core/motion/fonts/model';
import type { FontFile } from '$lib/motion/fonts/library';

export type OrgFontFace = FontFile & { url: string | null };

export function orgFontCss(faces: readonly OrgFontFace[]): string {
  return faces
    .filter((f) => f.url)
    .map((f) => `@font-face{font-family:${JSON.stringify(f.family)};src:url(${JSON.stringify(f.url)});font-weight:${variantWeight(f)};font-style:${f.italic ? 'italic' : 'normal'};font-display:block}`)
    .join('');
}
