import { faceBook, faceRules } from '$lib/motion/gpu-full/text/fonts';
import { fontkitSource } from '$lib/motion/gpu-full/text/fontkit-face';
import { glyphsOf } from '$lib/canvas/core/glyphs';
import { iconContours } from '$lib/canvas/core/icon-outline';
import type { Glyphs } from '$lib/canvas/core/chrome';
import { NODE_KIND_ICON } from '$lib/canvas/node-label';
import type { NodeType } from '$lib/canvas/node-data';
import { iconNodes } from './icon-nodes';
import type { CardIcons } from '$lib/canvas/core/card-kit';
import ImagePlus from '@lucide/svelte/icons/image-plus';
import CircleDollarSign from '@lucide/svelte/icons/circle-dollar-sign';
import Layers from '@lucide/svelte/icons/layers';
import Play from '@lucide/svelte/icons/play';
import UserRound from '@lucide/svelte/icons/user-round';

const APP_FONT = '/fonts/dm-sans-latin.woff2';
const FAMILY = 'DM Sans';
const REGULAR = 400;
const BOLD = 600;
const ICON_PX = 12;
const ICON_STROKE = 1.8;
const REFERENCES_PX = 14;
const REFERENCES_STROKE = 1.7;
const CREDIT_PX = 12.6;
const CREDIT_STROKE = 1.8;
const HEAD_PX = 13;
const HEAD_STROKE = 1.8;
const BADGE_PX = 11;
const BADGE_STROKE = 2;
const PERSON_PX = 28;
const PERSON_STROKE = 1.5;

export type CoreText = { glyphs: Glyphs; bold: Glyphs; icons: Map<NodeType, number[][]>; gen: CardIcons };

export async function coreText(kinds: readonly NodeType[]): Promise<CoreText> {
  const url = new URL(APP_FONT, location.origin).href;
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const css = `@font-face { font-family: '${FAMILY}'; font-weight: 100 1000; src: url('${url}'); }`;
  const book = faceBook(faceRules(css), new Map([[url, fontkitSource(bytes)]]), []);
  const icons = new Map(await Promise.all(kinds.map(async (k) => [k, iconContours(await iconNodes(NODE_KIND_ICON[k]), ICON_PX, ICON_STROKE)] as const)));
  const head = new Map(await Promise.all(kinds.map(async (k) => [k, iconContours(await iconNodes(NODE_KIND_ICON[k]), HEAD_PX, HEAD_STROKE)] as const)));
  const gen = { head, layers: iconContours(await iconNodes(Layers), BADGE_PX, BADGE_STROKE), play: iconContours(await iconNodes(Play), BADGE_PX, BADGE_STROKE), person: iconContours(await iconNodes(UserRound), PERSON_PX, PERSON_STROKE), references: iconContours(await iconNodes(ImagePlus), REFERENCES_PX, REFERENCES_STROKE), credit: iconContours(await iconNodes(CircleDollarSign), CREDIT_PX, CREDIT_STROKE) };
  return { glyphs: glyphsOf(book, FAMILY, REGULAR), bold: glyphsOf(book, FAMILY, BOLD), icons, gen };
}
