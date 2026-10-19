import { mul2d, type Affine } from '$lib/motion/affine';
import type { PathItem } from '$lib/motion/gpu-full/display-list';
import type { Viewport } from '$lib/canvas/dot-grid';
import type { Box, Curve } from '$lib/canvas/gpu/geometry';
import type { SnapGuide } from '$lib/canvas/snap';
import { EdgeLook, edgeItems, guideItems, marqueeItems, type CoreTheme } from './overlay';

const ITERATE = 'iterate';

export type Wire = { id: string; source: string; target: string; mode?: string };

export type WorldOverlay = { curves: readonly { edge: Wire; curve: Curve }[]; selected: readonly string[]; selectedEdge: string | null; marquee: Box | null; guides: readonly SnapGuide[]; zoom: number; theme: CoreTheme };

export function edgeLook(edge: Wire, selected: readonly string[], selectedEdge: string | null): EdgeLook {
  if (edge.mode === ITERATE) {
    return EdgeLook.Iterate;
  }
  const linked = edge.id === selectedEdge || selected.includes(edge.source) || selected.includes(edge.target);
  return linked ? EdgeLook.Linked : EdgeLook.Plain;
}

export function overlayOf(o: WorldOverlay): PathItem[] {
  return [
    ...o.curves.flatMap((c) => edgeItems(c.edge.id, c.curve, edgeLook(c.edge, o.selected, o.selectedEdge), o.theme)),
    ...(o.marquee ? marqueeItems(o.marquee, o.zoom, o.theme) : []),
    ...guideItems(o.guides, o.zoom, o.theme)
  ];
}

export function throughCamera(items: readonly PathItem[], view: Viewport): PathItem[] {
  const camera: Affine = [view.zoom, 0, 0, view.zoom, view.x, view.y];
  return items.map((i) => ({ ...i, matrix: mul2d(camera, i.matrix) }));
}
