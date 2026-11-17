import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { FillType, fillsOf } from '@feega/motion-core/motion/fill/model';

const PAGE_SHARE = 0.5;

const areaOf = (clip: MotionClip) => Number(clip.props.width ?? 0) * Number(clip.props.height ?? 0);

function solidOf(clip: MotionClip): string | null {
  const fills = fillsOf(clip.props);
  const solid = fills.find((f) => f.type === FillType.Solid && f.visible !== false);
  return solid && solid.type === FillType.Solid ? solid.color : null;
}

export function standInFill(doc: MotionDoc): string | null {
  const roots = doc.tracks.flatMap((t) => t.clips).filter((c) => !c.parent && c.component === 'Shape');
  const page = roots.filter((c) => c.id !== doc.surface && areaOf(c) >= PAGE_SHARE && solidOf(c));
  const surface = roots.find((c) => c.id === doc.surface);
  const chosen = page.sort((a, b) => areaOf(b) - areaOf(a))[0] ?? surface;
  return chosen ? solidOf(chosen) : null;
}
