import { COMPONENTS, type ComponentId } from '@feega/motion-core/motion/components';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { LAYOUT_KIND_LABEL, layoutKind } from '@feega/motion-core/motion/layout/stack';
import type { AutoLayout } from '@feega/motion-core/motion/layout/model';

const SHAPE_NAME: Partial<Record<string, string>> = {
  [ShapeKind.Rect]: 'Box',
  [ShapeKind.Ellipse]: 'Ellipse',
  [ShapeKind.Path]: 'Path',
  [ShapeKind.Vector]: 'Vector'
};

type Named = { component: string; props: Record<string, unknown>; autoLayout?: Pick<AutoLayout, 'direction'> | null };

export function elementName(clip: Named): string {
  const kind = layoutKind(clip);
  if (kind) {
    return LAYOUT_KIND_LABEL[kind];
  }
  const shape = clip.component === 'Shape' ? SHAPE_NAME[String(clip.props.shape)] : undefined;
  return shape ?? COMPONENTS[clip.component as ComponentId]?.label ?? clip.component;
}
