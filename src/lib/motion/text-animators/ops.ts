import { Ease } from '../design';
import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { setKeyframes, type OpResult } from '../timeline';
import { ANIMATOR_PREFIX, AnimatorUnit, MAX_ANIMATORS, SelectorShape, animatorKey, animatorSchema, type TextAnimator } from './model';

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

function sameUnit(animators: TextAnimator[]): string | null {
  return new Set(animators.map((a) => a.unit)).size > 1 ? 'every animator of a clip splits the text the same way (char, word or line)' : null;
}

export function onPathProblem(animators: readonly TextAnimator[]): string | null {
  return animators.some((a) => a.unit !== AnimatorUnit.Char) ? 'text on a path is laid out per character: its text animators must use unit char' : null;
}

function unitProblem(clip: MotionClip, animators: TextAnimator[]): string | null {
  return sameUnit(animators) ?? (clip.textPath ? onPathProblem(animators) : null);
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
  LineMaskUp = 'line-mask-up'
}

export const TEXT_PRESETS = Object.values(TextPreset) as [TextPreset, ...TextPreset[]];

type Preset = { about: string; animator: AnimatorInput; from: number; to: number };

export const PRESETS: Record<TextPreset, Preset> = {
  [TextPreset.BlurUp]: {
    about: 'each character rises out of a blur, left to right',
    animator: { unit: AnimatorUnit.Char, shape: SelectorShape.Smooth, softness: 0.35, start: 0, end: 200, values: { opacity: 0, y: 0.35, blur: 14 } },
    from: -40,
    to: 135
  },
  [TextPreset.WordStagger]: {
    about: 'words fade and slide up one after another',
    animator: { unit: AnimatorUnit.Word, shape: SelectorShape.Ramp, softness: 0.5, start: 0, end: 200, values: { opacity: 0, y: 0.6 } },
    from: -55,
    to: 150
  },
  [TextPreset.LineMaskUp]: {
    about: 'each line slides up from below its own baseline, like a mask reveal',
    animator: { unit: AnimatorUnit.Line, shape: SelectorShape.Smooth, softness: 0.4, start: 0, end: 200, values: { y: 1.2 } },
    from: -45,
    to: 140
  }
};

export function applyPreset(doc: MotionDoc, clipId: string, preset: TextPreset, span: { start: number; duration: number }, id: string): OpResult {
  const spec = PRESETS[preset];
  const added = addAnimator(doc, clipId, id, spec.animator);
  if (!added.ok) {
    return added;
  }
  return setKeyframes(added.doc, clipId, animatorKey(id, 'offset'), [
    { frame: span.start, value: spec.from, ease: Ease.Linear },
    { frame: span.start + span.duration, value: spec.to, ease: Ease.Linear }
  ]);
}
