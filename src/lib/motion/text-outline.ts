import type { BrandTokens } from '@feega/motion-core/motion/brand';
import { COMPONENTS } from '@feega/motion-core/motion/components';
import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { elementFills } from '@feega/motion-core/motion/fill/elements';
import { prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import type { Command, FaceBook } from '@feega/motion-core/motion/gpu-full/text/face';
import { outlinesOf, planOf, Smoothing, type Outlined, type OutlinedGlyph, type TextComponent } from '@feega/motion-core/motion/gpu-full/text/painter';
import { TRANSFORM_KEYS } from '@feega/motion-core/motion/keyframes';
import type { Box } from '@feega/motion-core/motion/layout';
import { pivotBox } from '@feega/motion-core/motion/parent';
import { MAX_PATH, ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { strokesOf } from '@feega/motion-core/motion/stroke/model';
import { editClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { isText } from '@feega/motion-core/motion/layout/text-extent';

export type Lettering = { fonts: FaceBook; tokens: BrandTokens; assets: Record<string, string> };

const CAPTION = 'Caption';
const KEPT_LAYOUT = ['x', 'y', 'width', 'height', 'opacity', 'scale', 'rotation', 'move', 'easing'] as const;
const PIXEL_STEP = 0.05;

const fail = (error: string): OpResult => ({ ok: false, error });

type Place = (x: number, y: number) => string;

function placer(box: Box): Place {
  const digits = Math.max(0, Math.ceil(Math.log10(Math.max(box.width, box.height) / PIXEL_STEP)));
  const unit = (v: number, side: number) => String(Number((v / side).toFixed(digits)));
  return (x, y) => `${unit(x, box.width)} ${unit(y, box.height)}`;
}

function glyphData({ face, glyph, size, skew, x, y }: OutlinedGlyph, place: Place): string {
  const scale = size / face.unitsPerEm;
  const point = (ux: number, uy: number) => place(x + (ux + uy * skew) * scale, y - uy * scale);
  const step = ({ op, at }: Command) => `${op}${Array.from({ length: at.length / 2 }, (_, i) => point(at[i * 2], at[i * 2 + 1])).join(' ')}`;
  return face.outline(glyph).map(step).join('');
}

const barData = (bar: number[], place: Place) => `M${Array.from({ length: bar.length / 2 }, (_, i) => place(bar[i * 2], bar[i * 2 + 1])).join('L')}Z`;

function pathOf({ glyphs, bars }: Outlined, box: Box): string {
  const place = placer(box);
  return [...glyphs.map((g) => glyphData(g, place)), ...bars.map((b) => barData(b, place))].join('');
}

const SHAPE_KEYS = new Set<string>([...Object.keys(COMPONENTS.Shape.schema.shape), ...TRANSFORM_KEYS]);

function asShape(clip: MotionClip, path: string): MotionClip {
  const kept = Object.fromEntries(KEPT_LAYOUT.filter((k) => k in clip.props).map((k) => [k, clip.props[k]]));
  const props = COMPONENTS.Shape.schema.parse({ ...kept, shape: ShapeKind.Path, path, fills: elementFills(clip.component, clip.props), strokes: strokesOf(clip.props) });
  const keyframes = Object.fromEntries(Object.entries(clip.keyframes).filter(([key]) => SHAPE_KEYS.has(key)));
  return { ...clip, component: 'Shape', props: props as Record<string, unknown>, keyframes, animators: [], partStyles: undefined };
}

function outlined(doc: MotionDoc, clip: MotionClip, { fonts, tokens, assets }: Lettering): string | null {
  const placed = prepare(doc, tokens, assets, { fonts, smoothing: Smoothing.Plain }).doc;
  const props = (findClip(placed, clip.id)?.clip ?? clip).props;
  const stage = { width: doc.width, height: doc.height };
  const box = pivotBox(props, stage);
  const plan = planOf({ component: clip.component as TextComponent, smoothing: Smoothing.Plain, props, box, stage, colour: (v) => v, time: 0, trim: 0, fps: doc.fps, still: 0, fonts, animators: [], asset: (id) => id });
  const laid = typeof plan === 'string' ? plan : outlinesOf(plan, fonts);
  return typeof laid === 'string' ? null : pathOf(laid, box);
}

export function textToPath(doc: MotionDoc, clipId: string, lettering: Lettering): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return fail(`no clip ${clipId}`);
  }
  if (!isText(clip.component) || clip.component === CAPTION) {
    return fail(`${clipId} is a ${clip.component}: only Title, Text and Kicker outline`);
  }
  if (clip.textPath) {
    return fail(`${clipId} runs along a path: remove the text path first`);
  }

  const path = outlined(doc, clip, lettering);
  if (path === null) {
    return fail(`the font of ${clipId} could not be loaded to outline it`);
  }
  if (!path) {
    return fail(`${clipId} has no letters to outline`);
  }
  if (path.length > MAX_PATH) {
    return fail(`${clipId} has too much text to be one path: outline a shorter piece`);
  }

  return editClip(doc, clipId, (c) => asShape(c, path));
}
