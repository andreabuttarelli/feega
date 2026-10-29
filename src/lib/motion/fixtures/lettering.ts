import { readFileSync } from 'node:fs';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { FontCategory, FontSource, type FontFace } from '@feega/motion-core/motion/fonts/model';
import { faceBook, type FaceRule, type Source } from '@feega/motion-core/motion/gpu-full/text/fonts';
import { fontkitSource } from '@feega/motion-core/motion/gpu-full/text/fontkit-face';
import type { Lettering } from '../text-outline';

const LATIN: [number, number][] = [[0, 0xff]];

const rules: FaceRule[] = [
  { family: 'DM Sans', italic: false, weight: [100, 1000], url: 'static/fonts/dm-sans-latin.woff2', ranges: LATIN },
  { family: 'Inter', italic: false, weight: [100, 900], url: 'static/fonts/inter-latin.woff2', ranges: LATIN },
  { family: 'Fraunces', italic: false, weight: [100, 900], url: 'static/fonts/fraunces-latin.woff2', ranges: LATIN },
  { family: 'Fragment Mono', italic: false, weight: [400, 400], url: 'static/fonts/fragment-mono-latin.woff2', ranges: LATIN }
];

const sources = new Map<string, Source>(rules.map((r) => [r.url, fontkitSource(new Uint8Array(readFileSync(r.url)))]));

export const registry: FontFace[] = [
  { family: 'Inter', source: FontSource.Google, category: FontCategory.Sans, weights: [300, 400, 700], italic: false, axes: [] },
  { family: 'Fraunces', source: FontSource.Google, category: FontCategory.Serif, weights: [400, 700], italic: false, axes: [] }
];

export const lettering: Lettering = { fonts: faceBook(rules, sources, registry), tokens: FEEGA_TOKENS, assets: {} };
