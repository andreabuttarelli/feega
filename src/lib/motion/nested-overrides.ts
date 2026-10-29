import { compOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { MAX_COMP_DEPTH } from '@feega/motion-core/motion/precomp';
import { innerClips, type Overrides } from './main-component';

export type ClipPath = string[];
export type PathChange = { path: ClipPath; props: Record<string, unknown> };

export function pathTo(doc: MotionDoc, compId: string, clipId: string, depth = 0): ClipPath | null {
  const comp = doc.comps[compId];
  if (!comp || depth > MAX_COMP_DEPTH) {
    return null;
  }
  for (const clip of innerClips(comp)) {
    if (clip.id === clipId) {
      return [clip.id];
    }
    const inner = compOf(clip);
    const below = inner ? pathTo(doc, inner, clipId, depth + 1) : null;
    if (below) {
      return [clip.id, ...below];
    }
  }
  return null;
}

function applied(doc: MotionDoc, compId: string, base: Overrides, [head, ...rest]: ClipPath, props: Record<string, unknown>): Overrides {
  if (!rest.length) {
    return { ...base, [head]: { ...base[head], ...props } };
  }
  const clip = innerClips(doc.comps[compId]).find((c) => c.id === head);
  const inner = clip ? compOf(clip) : null;
  if (!clip || !inner) {
    return base;
  }
  const below = (base[head]?.overrides ?? clip.props.overrides ?? {}) as Overrides;
  return { ...base, [head]: { ...base[head], overrides: applied(doc, inner, below, rest, props) } };
}

export const nestedOverrides = (doc: MotionDoc, compId: string, changes: readonly PathChange[]): Overrides => changes.reduce<Overrides>((acc, change) => applied(doc, compId, acc, change.path, change.props), {});
