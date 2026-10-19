import type { MotionClip, MotionDoc } from './doc';
import { fittedTextBox, sizingAfterResize, TextSizing } from './text-sizing';

type PxBox = { left: number; top: number; width: number; height: number };

const SIZED = new Set<string>(['Text']);

function fitted(clip: MotionClip, box: PxBox | undefined, doc: MotionDoc): MotionClip | null {
  if (!SIZED.has(clip.component) || !box || clip.parent) {
    return null;
  }
  const p = clip.props as { x: number; y: number; width: number; height: number; sizing?: TextSizing };
  const next = fittedTextBox(p.sizing ?? TextSizing.Fixed, p, box, doc);
  return next ? { ...clip, props: { ...clip.props, ...next } } : null;
}

export function fitTexts(doc: MotionDoc, boxes: Record<string, PxBox>): MotionDoc | null {
  let changed = false;
  const tracks = doc.tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => {
      const next = fitted(c as MotionClip, boxes[c.id], doc);
      changed ||= next !== null;
      return next ?? c;
    })
  }));
  return changed ? { ...doc, tracks } : null;
}

export function freeTextFit(doc: MotionDoc, boxes: Record<string, PxBox>): { width: number; height: number } | null {
  const clips = doc.tracks.flatMap((t) => t.clips as MotionClip[]);
  const [only] = clips;
  if (clips.length !== 1) {
    return null;
  }
  const next = fitted(only, boxes[only.id], doc);
  return next ? { width: Number(next.props.width), height: Number(next.props.height) } : null;
}

const sizingOf = (clip: MotionClip) => ((clip.props as { sizing?: TextSizing }).sizing ?? TextSizing.Fixed);

const withSizing = (clip: MotionClip, changed: { width: boolean; height: boolean }): MotionClip => {
  const sizing = sizingAfterResize(sizingOf(clip), changed);
  return sizing === sizingOf(clip) ? clip : { ...clip, props: { ...clip.props, sizing } };
};

const mapTexts = (doc: MotionDoc, f: (clip: MotionClip) => MotionClip): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (SIZED.has(c.component) ? f(c as MotionClip) : c)) })) });

export function resizedTexts(before: MotionDoc, after: MotionDoc): MotionDoc {
  const was = new Map(before.tracks.flatMap((t) => t.clips.map((c) => [c.id, c as MotionClip] as const)));
  return mapTexts(after, (clip) => {
    const old = was.get(clip.id);
    if (!old) {
      return clip;
    }
    return withSizing(clip, { width: old.props.width !== clip.props.width, height: old.props.height !== clip.props.height });
  });
}

export function resizedFreeText(doc: MotionDoc, changed: { width: boolean; height: boolean }): MotionDoc | null {
  let switched = false;
  const next = mapTexts(doc, (clip) => {
    const sized = withSizing(clip, changed);
    switched ||= sized !== clip;
    return sized;
  });
  return switched ? next : null;
}

type Size = { width: number; height: number };

export function keepTextSize(doc: MotionDoc, was: Size, now: Size): MotionDoc {
  const factor = Math.min(was.width, was.height) / Math.min(now.width, now.height);
  if (!Number.isFinite(factor) || factor === 1) {
    return doc;
  }
  return mapTexts(doc, (clip) => ({ ...clip, props: { ...clip.props, size: Number(clip.props.size) * factor } }));
}

