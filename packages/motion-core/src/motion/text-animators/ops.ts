import { Ease } from '../design';
import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { setKeyframes, type OpResult } from '../timeline';
import { ANIMATOR_PREFIX, AnimatorUnit, MAX_ANIMATORS, SelectorShape, animatorKey, animatorSchema, type TextAnimator } from './model';
import { unitPositions } from './split';

const fail = (error: string): OpResult => ({ ok: false, error });

export const TEXT_COMPONENTS: ReadonlySet<string> = new Set(['Title', 'Text', 'Kicker', 'Caption']);

export type AnimatorInput = Partial<Omit<TextAnimator, 'id' | 'values'>> & { values?: TextAnimator['values'] };
export type AnimatorPatch = AnimatorInput & { index?: number };

function editAnimators(doc: MotionDoc, clipId: string, edit: (clip: MotionClip) => MotionClip | string): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  if (!TEXT_COMPONENTS.has(found.clip.component)) {
    return fail(`${found.clip.component} has no text to animate; text animators go on ${[...TEXT_COMPONENTS].join(', ')}`);
  }
  const next = edit(found.clip);
  if (typeof next === 'string') {
    return fail(next);
  }
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? next : c)) })) } };
}

function validated(input: unknown): TextAnimator | string {
  const parsed = animatorSchema.safeParse(input);
  return parsed.success ? parsed.data : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

export function onPathProblem(animators: readonly TextAnimator[]): string | null {
  return animators.some((a) => a.unit !== AnimatorUnit.Char) ? 'text on a path is laid out per character: its text animators must use unit char' : null;
}

function unitProblem(clip: MotionClip, animators: TextAnimator[]): string | null {
  return clip.textPath ? onPathProblem(animators) : null;
}

export function addAnimator(doc: MotionDoc, clipId: string, id: string, input: AnimatorInput): OpResult {
  return editAnimators(doc, clipId, (clip) => {
    if (clip.animators.length >= MAX_ANIMATORS) {
      return `a clip holds at most ${MAX_ANIMATORS} text animators`;
    }
    const animator = validated({ unit: AnimatorUnit.Char, ...input, id });
    if (typeof animator === 'string') {
      return animator;
    }
    const animators = [...clip.animators, animator];
    return unitProblem(clip, animators) ?? { ...clip, animators };
  });
}

export function setAnimator(doc: MotionDoc, clipId: string, id: string, patch: AnimatorPatch): OpResult {
  return editAnimators(doc, clipId, (clip) => {
    const current = clip.animators.find((a) => a.id === id);
    if (!current) {
      return `no text animator ${id} on ${clipId}; it has ${clip.animators.map((a) => a.id).join(', ') || 'none'}`;
    }
    const { index, values, ...rest } = patch;
    const animator = validated({ ...current, ...rest, values: { ...current.values, ...values }, id });
    if (typeof animator === 'string') {
      return animator;
    }
    const others = clip.animators.filter((a) => a.id !== id);
    const at = Math.min(Math.max(0, index ?? clip.animators.indexOf(current)), others.length);
    const animators = [...others.slice(0, at), animator, ...others.slice(at)];
    return unitProblem(clip, animators) ?? { ...clip, animators };
  });
}

export function removeAnimator(doc: MotionDoc, clipId: string, id: string): OpResult {
  return editAnimators(doc, clipId, (clip) => {
    if (!clip.animators.some((a) => a.id === id)) {
      return `no text animator ${id} on ${clipId}`;
    }
    const owned = (key: string) => key.startsWith(`${ANIMATOR_PREFIX}.${id}.`);
    return {
      ...clip,
      animators: clip.animators.filter((a) => a.id !== id),
      keyframes: Object.fromEntries(Object.entries(clip.keyframes).filter(([key]) => !owned(key))),
      expressions: Object.fromEntries(Object.entries(clip.expressions).filter(([key]) => !owned(key)))
    };
  });
}

export enum TextPreset {
  BlurUp = 'blur-up',
  WordStagger = 'word-stagger',
  LineMaskUp = 'line-mask-up',
  FadeChars = 'fade-chars',
  FadeWords = 'fade-words',
  FadeLines = 'fade-lines',
  SlideWords = 'slide-words',
  SlideLines = 'slide-lines',
  ScaleChars = 'scale-chars',
  BlurWords = 'blur-words',
  DropChars = 'drop-chars',
  SpinChars = 'spin-chars',
  Typewriter = 'typewriter'
}

export const TEXT_PRESETS = Object.values(TextPreset) as [TextPreset, ...TextPreset[]];

type Preset = { about: string; animator: Required<Pick<AnimatorInput, 'unit' | 'softness' | 'start'>> & AnimatorInput };

export const PRESET_LABEL: Record<TextPreset, string> = {
  [TextPreset.BlurUp]: 'Blur up',
  [TextPreset.WordStagger]: 'Word stagger',
  [TextPreset.LineMaskUp]: 'Line mask up',
  [TextPreset.FadeChars]: 'Fade letters',
  [TextPreset.FadeWords]: 'Fade words',
  [TextPreset.FadeLines]: 'Fade lines',
  [TextPreset.SlideWords]: 'Slide words',
  [TextPreset.SlideLines]: 'Slide lines',
  [TextPreset.ScaleChars]: 'Scale letters',
  [TextPreset.BlurWords]: 'Blur words',
  [TextPreset.DropChars]: 'Drop letters',
  [TextPreset.SpinChars]: 'Spin letters',
  [TextPreset.Typewriter]: 'Typewriter'
};

export const PRESETS: Record<TextPreset, Preset> = {
  [TextPreset.BlurUp]: {
    about: 'each character rises out of a blur, left to right',
    animator: { unit: AnimatorUnit.Char, shape: SelectorShape.Smooth, softness: 0.35, start: 0, end: 200, values: { opacity: 0, y: 0.35, blur: 14 } }
  },
  [TextPreset.WordStagger]: {
    about: 'words fade and slide up one after another',
    animator: { unit: AnimatorUnit.Word, shape: SelectorShape.Ramp, softness: 0.5, start: 0, end: 200, values: { opacity: 0, y: 0.6 } }
  },
  [TextPreset.LineMaskUp]: {
    about: 'each line slides up from below its own baseline, like a mask reveal',
    animator: { unit: AnimatorUnit.Line, shape: SelectorShape.Smooth, softness: 0.4, start: 0, end: 200, values: { y: 1.2 } }
  },
  [TextPreset.FadeChars]: {
    about: 'each character fades in, left to right',
    animator: { unit: AnimatorUnit.Char, shape: SelectorShape.Ramp, softness: 0.5, start: 0, end: 200, values: { opacity: 0 } }
  },
  [TextPreset.FadeWords]: {
    about: 'words fade in one after another',
    animator: { unit: AnimatorUnit.Word, shape: SelectorShape.Ramp, softness: 0.5, start: 0, end: 200, values: { opacity: 0 } }
  },
  [TextPreset.FadeLines]: {
    about: 'lines fade in one after another',
    animator: { unit: AnimatorUnit.Line, shape: SelectorShape.Ramp, softness: 0.5, start: 0, end: 200, values: { opacity: 0 } }
  },
  [TextPreset.SlideWords]: {
    about: 'words slide in from the left while they fade',
    animator: { unit: AnimatorUnit.Word, shape: SelectorShape.Smooth, softness: 0.4, start: 0, end: 200, values: { opacity: 0, x: -0.5 } }
  },
  [TextPreset.SlideLines]: {
    about: 'lines slide in from the right while they fade',
    animator: { unit: AnimatorUnit.Line, shape: SelectorShape.Smooth, softness: 0.4, start: 0, end: 200, values: { opacity: 0, x: 0.8 } }
  },
  [TextPreset.ScaleChars]: {
    about: 'each character grows from small while it fades in',
    animator: { unit: AnimatorUnit.Char, shape: SelectorShape.Smooth, softness: 0.4, start: 0, end: 200, values: { opacity: 0, scale: 0.2 } }
  },
  [TextPreset.BlurWords]: {
    about: 'words come out of a blur one after another',
    animator: { unit: AnimatorUnit.Word, shape: SelectorShape.Smooth, softness: 0.5, start: 0, end: 200, values: { opacity: 0, blur: 12 } }
  },
  [TextPreset.DropChars]: {
    about: 'each character drops in from above',
    animator: { unit: AnimatorUnit.Char, shape: SelectorShape.Smooth, softness: 0.35, start: 0, end: 200, values: { opacity: 0, y: -0.7 } }
  },
  [TextPreset.SpinChars]: {
    about: 'each character turns upright as it fades in',
    animator: { unit: AnimatorUnit.Char, shape: SelectorShape.Smooth, softness: 0.35, start: 0, end: 200, values: { opacity: 0, rotation: -90, y: 0.3 } }
  },
  [TextPreset.Typewriter]: {
    about: 'characters appear one at a time, no fade',
    animator: { unit: AnimatorUnit.Char, shape: SelectorShape.Square, softness: 0, start: 0, end: 200, values: { opacity: 0 } }
  }
};

const LONE_UNIT = [0.5];
const MIN_SWEEP_MARGIN = 0.01;

function sweepOf(spec: Preset, text: string): { from: number; to: number } {
  const found = unitPositions(text, spec.animator.unit);
  const at = found.length ? found : LONE_UNIT;
  const { softness, start } = spec.animator;
  return { from: (Math.min(...at) - Math.max(softness, MIN_SWEEP_MARGIN)) * 100 - start, to: Math.max(...at) * 100 - start };
}

export function applyPreset(doc: MotionDoc, clipId: string, preset: TextPreset, span: { start: number; duration: number }, id: string): OpResult {
  const spec = PRESETS[preset];
  const sweep = sweepOf(spec, String(findClip(doc, clipId)?.clip.props.text ?? ''));
  const added = addAnimator(doc, clipId, id, spec.animator);
  if (!added.ok) {
    return added;
  }
  return setKeyframes(added.doc, clipId, animatorKey(id, 'offset'), [
    { frame: span.start, value: sweep.from, ease: Ease.Linear },
    { frame: span.start + span.duration, value: sweep.to, ease: Ease.Linear }
  ]);
}
