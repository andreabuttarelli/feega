import { findClip, type MotionClip, type MotionDoc } from './doc';

const kindOf = (clip: MotionClip) => (clip.component === 'Shape' ? `Shape:${String(clip.props.shape)}` : clip.component);

export function matchingLayers(doc: MotionDoc, selection: readonly string[]): string[] {
  const kinds = new Set(selection.flatMap((id) => {
    const clip = findClip(doc, id)?.clip;
    return clip ? [kindOf(clip)] : [];
  }));

  return doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => kinds.has(kindOf(c))).map((c) => c.id);
}
