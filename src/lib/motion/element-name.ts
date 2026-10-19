import { COMPONENTS, type ComponentId } from './components';
import { ShapeKind } from './shape/schema';

const SHAPE_NAME: Partial<Record<string, string>> = {
  [ShapeKind.Rect]: 'Box',
  [ShapeKind.Ellipse]: 'Ellipse',
  [ShapeKind.Path]: 'Path',
  [ShapeKind.Vector]: 'Vector'
};

type Named = { component: string; props: Record<string, unknown> };

export function elementName(clip: Named): string {
  const shape = clip.component === 'Shape' ? SHAPE_NAME[String(clip.props.shape)] : undefined;
  return shape ?? COMPONENTS[clip.component as ComponentId]?.label ?? clip.component;
}
