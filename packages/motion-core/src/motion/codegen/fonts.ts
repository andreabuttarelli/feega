import type { MotionDoc } from '../doc';
import { FontSource, googleFontsUrl, uniqueFaces, usedFaces, variantsOf, variantWeight, type Face, type FontFace } from '../fonts/model';
import type { FontFile, PageFonts } from './ir';

export type FontInput = { ref: (assetId: string) => string; urls: Record<string, string>; notes: Set<string> };

const DISPLAY_BLOCK = 'display=block';
const DISPLAY_SWAP = 'display=swap';

function facesOf(doc: MotionDoc): Face[] {
  const spaces = [doc, ...Object.values(doc.comps)];
  return uniqueFaces(spaces.flatMap((space) => usedFaces({ tracks: space.tracks as never, components: doc.components as never })));
}

function usedRegistry(doc: MotionDoc, source: FontSource): FontFace[] {
  const families = new Set(facesOf(doc).map((f) => f.family));
  return doc.fonts.filter((f) => f.source === source && families.has(f.family));
}

export const fontAssetIds = (doc: MotionDoc): string[] => usedRegistry(doc, FontSource.Upload).flatMap((face) => variantsOf(face).map((v) => v.assetId));

const filesOf = (face: FontFace, input: FontInput): FontFile[] =>
  variantsOf(face).flatMap((v) => (input.urls[v.assetId] ? [{ family: face.family, ref: input.ref(v.assetId), weight: variantWeight(v), italic: v.italic }] : []));

export function planFonts(doc: MotionDoc, input: FontInput): PageFonts {
  const uploads = usedRegistry(doc, FontSource.Upload);
  const locals = usedRegistry(doc, FontSource.Local);
  const googles = usedRegistry(doc, FontSource.Google);
  const files = uploads.flatMap((face) => filesOf(face, input));
  for (const face of uploads.filter((f) => !filesOf(f, { ...input, ref: () => '' }).length)) {
    input.notes.add(`${face.family}: the uploaded font file is missing, so the page falls back to a system font.`);
  }
  for (const face of locals) {
    input.notes.add(`${face.family}: this font is installed on the designer machine only and is not bundled; install it where the page runs.`);
  }
  const google = googles.length ? googleFontsUrl(facesOf(doc), doc.fonts)?.replace(DISPLAY_BLOCK, DISPLAY_SWAP) ?? null : null;
  return { files, google, handled: [...uploads, ...locals, ...googles].map((f) => f.family) };
}
