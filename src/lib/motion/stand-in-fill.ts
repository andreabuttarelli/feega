import { FillType, fillsOf, type Fill } from '@feega/motion-core/motion/fill/model';

const PAGE_SHARE = 0.5;

type Shape = { id: unknown; props: Record<string, unknown> };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const isRootShape = (clip: unknown): clip is Shape => isObject(clip) && clip.component === 'Shape' && !clip.parent && isObject(clip.props);

const areaOf = (clip: Shape) => Number(clip.props.width ?? 0) * Number(clip.props.height ?? 0);

function readableFills(props: Record<string, unknown>): Fill[] {
  try {
    return fillsOf(props);
  } catch {
    return [];
  }
}

function solidOf(clip: Shape): string | null {
  const solid = readableFills(clip.props).find((f) => f.type === FillType.Solid && f.visible !== false);
  return solid && solid.type === FillType.Solid ? solid.color : null;
}

export function standInFill(doc: unknown): string | null {
  if (!isObject(doc)) {
    return null;
  }

  const roots = listOf(doc.tracks).flatMap((t) => (isObject(t) ? listOf(t.clips) : [])).filter(isRootShape);
  const page = roots.filter((c) => c.id !== doc.surface && areaOf(c) >= PAGE_SHARE && solidOf(c));
  const surface = roots.find((c) => c.id === doc.surface);
  const chosen = page.sort((a, b) => areaOf(b) - areaOf(a))[0] ?? surface;
  return chosen ? solidOf(chosen) : null;
}
