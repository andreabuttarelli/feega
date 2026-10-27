import type { MotionClip, MotionDoc, MotionTrack } from '../doc';
import { childrenInOrder } from './resolve';

const clipsOf = (tracks: readonly MotionTrack[]): MotionClip[] => tracks.flatMap((t) => t.clips as MotionClip[]);

const isStacked = (clip: MotionClip): clip is MotionClip & { autoLayout: NonNullable<MotionClip['autoLayout']> } => Boolean(clip.autoLayout?.firstOnTop);

function trackOfEach(tracks: readonly MotionTrack[], kids: readonly MotionClip[]): number[] | null {
  const at = kids.map((k) => tracks.findIndex((t) => t.clips.some((c) => c.id === k.id)));
  const alone = at.every((i) => i >= 0 && tracks[i].clips.length === 1) && new Set(at).size === at.length;
  return alone ? at : null;
}

function stacked(tracks: MotionTrack[]): MotionTrack[] {
  const all = clipsOf(tracks);
  let out = tracks;
  for (const box of all.filter(isStacked)) {
    const kids = childrenInOrder(all, box);
    const at = trackOfEach(out, kids);
    if (!at) {
      continue;
    }
    const slots = [...at].sort((a, b) => a - b);
    const moved = [...out];
    kids.forEach((_, i) => {
      moved[slots[i]] = out[at[i]];
    });
    out = moved;
  }
  return out;
}

const changes = (before: readonly MotionTrack[], after: readonly MotionTrack[]) => before.some((t, i) => t !== after[i]);

export function withStacking(doc: MotionDoc): MotionDoc {
  const tracks = stacked(doc.tracks);
  const comps = Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: stacked(comp.tracks) }] as const);
  const moved = changes(doc.tracks, tracks) || comps.some(([id, comp]) => changes(doc.comps[id].tracks, comp.tracks));
  return moved ? { ...doc, tracks, comps: Object.fromEntries(comps) } : doc;
}
