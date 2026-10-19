import { faceBook, faceRules } from '$lib/motion/gpu-full/text/fonts';
import { fontkitSource } from '$lib/motion/gpu-full/text/fontkit-face';
import { glyphsOf } from '$lib/canvas/core/glyphs';
import { iconContours } from '$lib/canvas/core/icon-outline';
import type { Glyphs } from '$lib/canvas/core/chrome';
import { NODE_KIND_ICON } from '$lib/canvas/node-label';
import type { NodeType } from '$lib/canvas/node-data';
import { iconNodes } from './icon-nodes';

const APP_FONT = '/fonts/dm-sans-latin.woff2';
const FAMILY = 'DM Sans';
const REGULAR = 400;
const BOLD = 600;
const ICON_PX = 12;
const ICON_STROKE = 1.8;

export type CoreText = { glyphs: Glyphs; bold: Glyphs; icons: Map<NodeType, number[][]> };

export async function coreText(kinds: readonly NodeType[]): Promise<CoreText> {
  const url = new URL(APP_FONT, location.origin).href;
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const css = `@font-face { font-family: '${FAMILY}'; font-weight: 100 1000; src: url('${url}'); }`;
  const book = faceBook(faceRules(css), new Map([[url, fontkitSource(bytes)]]), []);
  const icons = new Map(await Promise.all(kinds.map(async (k) => [k, iconContours(await iconNodes(NODE_KIND_ICON[k]), ICON_PX, ICON_STROKE)] as const)));
  return { glyphs: glyphsOf(book, FAMILY, REGULAR), bold: glyphsOf(book, FAMILY, BOLD), icons };
}
