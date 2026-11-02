import { COMPONENTS, type ComponentId } from '@feega/motion-core/motion/components';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { LAYOUT_KIND_LABEL, layoutKind } from '@feega/motion-core/motion/layout/stack';
import type { AutoLayout } from '@feega/motion-core/motion/layout/model';
import { CUSTOM_CLIP, componentLabel } from '@feega/motion-core/motion/poster-parts';

const SHAPE_NAME: Partial<Record<string, string>> = {
  [ShapeKind.Rect]: 'Box',
  [ShapeKind.Ellipse]: 'Ellipse',
  [ShapeKind.Path]: 'Path',
  [ShapeKind.Vector]: 'Vector'
};

type Named = { component: string; props: Record<string, unknown>; autoLayout?: Pick<AutoLayout, 'direction'> | null; group?: boolean };

const GROUP_NAME = 'Group';

export function elementName(clip: Named): string {
  const kind = layoutKind(clip);
  if (kind) {
    return LAYOUT_KIND_LABEL[kind];
  }
  if (clip.group) {
    return GROUP_NAME;
  }
  const shape = clip.component === 'Shape' ? SHAPE_NAME[String(clip.props.shape)] : undefined;
  return shape ?? COMPONENTS[clip.component as ComponentId]?.label ?? clip.component;
}

export function elementKind(clip: Named): string {
  const kind = layoutKind(clip);
  if (kind) {
    return LAYOUT_KIND_LABEL[kind];
  }
  return clip.group ? GROUP_NAME : (COMPONENTS[clip.component as ComponentId]?.label ?? clip.component);
}

type Comps = Readonly<Record<string, { name: string; component?: unknown }>>;
type Layer = Named & { name?: string };

const PRECOMP = 'Precomp';
const CUSTOM_KIND = 'Component';

const compNamed = (clip: Named, comps: Comps) => (clip.component === PRECOMP ? comps[String(clip.props.comp ?? '')] : undefined);
const firstLine = (text: unknown) => (typeof text === 'string' ? text.split('\n')[0].trim() : '');

export function layerLabel(clip: Layer, comps: Comps): string {
  const own = clip.component === CUSTOM_CLIP ? componentLabel(String(clip.props.name)) : firstLine(clip.props.text) || elementName(clip);
  return compNamed(clip, comps)?.name ?? (clip.name || own);
}

export function layerKind(clip: Named, comps: Comps): string {
  if (clip.component === CUSTOM_CLIP) {
    return CUSTOM_KIND;
  }
  const comp = compNamed(clip, comps);
  if (comp?.component) {
    return `Instance of ${comp.name}`;
  }
  return elementKind(clip);
}
