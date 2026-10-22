import { findClip, type MotionClip, type MotionDoc } from './doc';

const kindOf = (clip: MotionClip) => (clip.component === 'Shape' ? `Shape:${String(clip.props.shape)}` : clip.component);

const topClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

export function matchingLayers(doc: MotionDoc, selection: readonly string[]): string[] {
  const kinds = new Set(selection.flatMap((id) => {
    const clip = findClip(doc, id)?.clip;
    return clip ? [kindOf(clip)] : [];
  }));

  return topClips(doc).filter((c) => kinds.has(kindOf(c))).map((c) => c.id);
}

export enum Same {
  Fill = 'fill',
  Stroke = 'stroke',
  Font = 'font',
  Effect = 'effect'
}

const listed = (value: unknown): string | null => (Array.isArray(value) && value.length ? JSON.stringify(value) : null);

const solid = (color: unknown): string | null => (typeof color === 'string' ? JSON.stringify([{ type: 'solid', color }]) : null);

const SAME_KEY: Record<Same, (clip: MotionClip) => string | null> = {
  [Same.Fill]: (c) => listed(c.props.fills) ?? solid(c.props.color),
  [Same.Stroke]: (c) => listed(c.props.strokes),
  [Same.Font]: (c) => (typeof c.props.font === 'string' ? c.props.font : null),
  [Same.Effect]: (c) => listed(c.effects.map((e) => e.kind))
};

export function sameLayers(doc: MotionDoc, selection: readonly string[], same: Same): string[] {
  const keyOf = SAME_KEY[same];
  const keys = new Set(selection.flatMap((id) => {
    const clip = findClip(doc, id)?.clip;
    const key = clip ? keyOf(clip) : null;
    return key ? [key] : [];
  }));

  return topClips(doc).filter((c) => keys.has(keyOf(c) ?? '')).map((c) => c.id);
}
