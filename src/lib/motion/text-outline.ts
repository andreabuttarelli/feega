import { COMPONENTS } from './components';
import { findClip, type MotionClip, type MotionDoc } from './doc';
import { elementFills } from './fill/elements';
import type { Outliner, PathStep } from './fonts/outliner';
import { TRANSFORM_KEYS } from './keyframes';
import { pivotBox } from './parent';
import { MAX_PATH, ShapeKind } from './shape/schema';
import { strokesOf } from './stroke/model';
import { textLook } from './text-look';
import { measureText } from './text-measure';
import { editClip, type OpResult } from './timeline';
import { isText } from './layout/text-extent';
import { propsOwner, shownRecord } from './units';

const PRECISION = 1000;
const CAPTION = 'Caption';
const KEPT_LAYOUT = ['x', 'y', 'width', 'height', 'align', 'opacity', 'scale', 'rotation', 'move', 'easing'] as const;
const ALIGN_SHARE = { left: 0, center: 0.5, right: 1 } as const;

const fail = (error: string): OpResult => ({ ok: false, error });
const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

type Frame = { left: number; top: number; width: number; height: number };

const STEP_ARGS: Record<PathStep['type'], (s: PathStep) => (number | undefined)[]> = {
  M: (s) => [s.x, s.y],
  L: (s) => [s.x, s.y],
  Q: (s) => [s.x1, s.y1, s.x, s.y],
  C: (s) => [s.x1, s.y1, s.x2, s.y2, s.x, s.y],
  Z: () => []
};

function stepData(step: PathStep, box: Frame): string {
  const args = STEP_ARGS[step.type](step).map((v, i) => round(i % 2 === 0 ? ((v ?? 0) - box.left) / box.width : ((v ?? 0) - box.top) / box.height));
  return `${step.type}${args.join(' ')}`;
}

function lineData(line: string, origin: { x: number; baseline: number }, look: ReturnType<typeof textLook>, outliner: Outliner, box: Frame): string {
  const chars = [...line];
  return chars
    .map((char, i) => {
      const x = origin.x + (outliner.advance(chars.slice(0, i).join('')) + look.tracking * i) * look.size;
      return outliner.trace(char, x, origin.baseline, look.size).map((s) => stepData(s, box)).join('');
    })
    .join('');
}

function layoutData(text: string, look: ReturnType<typeof textLook>, box: Frame, outliner: Outliner): string {
  const block = measureText({ ...look, text, capitals: false }, box, outliner.advance);
  const lineHeight = look.size * look.leading;
  const gap = (lineHeight - (outliner.ascent + outliner.descent) * look.size) / 2;
  return block.lines
    .map((line, i) => {
      const width = (outliner.advance(line) + look.tracking * [...line].length) * look.size;
      const x = block.left + (block.width - width) * ALIGN_SHARE[look.align];
      const baseline = block.top + i * lineHeight + gap + outliner.ascent * look.size;
      return lineData(line, { x, baseline }, look, outliner, box);
    })
    .join('');
}

const casedText = (look: ReturnType<typeof textLook>, textCase: unknown) => {
  const text = look.capitals ? look.text.toUpperCase() : look.text;
  return textCase === 'lower' ? text.toLowerCase() : text;
};

const SHAPE_KEYS = new Set<string>([...Object.keys(COMPONENTS.Shape.schema.shape), ...TRANSFORM_KEYS]);

function asShape(clip: MotionClip, path: string): MotionClip {
  const kept = Object.fromEntries(KEPT_LAYOUT.filter((k) => k in clip.props).map((k) => [k, clip.props[k]]));
  const props = COMPONENTS.Shape.schema.parse({ ...kept, shape: ShapeKind.Path, path, fills: elementFills(clip.component, clip.props), strokes: strokesOf(clip.props) });
  const keyframes = Object.fromEntries(Object.entries(clip.keyframes).filter(([key]) => SHAPE_KEYS.has(key)));
  return { ...clip, component: 'Shape', props: props as Record<string, unknown>, keyframes, animators: [], partStyles: undefined };
}

export function textToPath(doc: MotionDoc, clipId: string, outliner: Outliner): OpResult {
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

  const shown = shownRecord(propsOwner(clip.component), clip.props, doc);
  const look = textLook(clip.component, shown);
  const path = layoutData(casedText(look, shown.textCase), look, pivotBox(clip.props, doc), outliner);
  if (!path) {
    return fail(`${clipId} has no letters to outline`);
  }
  if (path.length > MAX_PATH) {
    return fail(`${clipId} has too much text to be one path: outline a shorter piece`);
  }

  return editClip(doc, clipId, (c) => asShape(c, path));
}
